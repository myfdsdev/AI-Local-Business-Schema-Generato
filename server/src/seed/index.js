import { connectDatabase, disconnectDatabase } from '../config/database.js';
import {
  INITIAL_SCAN_CREDITS,
  PLAN_SLUGS,
  ROLES,
  SUBSCRIPTION_STATUS,
  USER_STATUS,
} from '../config/constants.js';
import { env } from '../config/env.js';
import logger from '../config/logger.js';
import {
  BusinessData,
  BusinessProject,
  CreditTransaction,
  Location,
  Plan,
  SchemaType,
  Subscription,
  User,
} from '../models/index.js';
import { normalizeDomain } from '../utils/url.js';
import { demoLocations, demoProjects } from './data/demo.js';
import { plans } from './data/plans.js';
import { schemaTypes } from './data/schemaTypes.js';

/**
 * Idempotent seed (spec section 29). Safe to run repeatedly: reference data is
 * upserted, and demo accounts/projects are only created when absent. Demo
 * passwords come from env vars and are never hardcoded.
 */

async function seedPlans() {
  for (const plan of plans) {
    await Plan.updateOne({ slug: plan.slug }, { $set: plan }, { upsert: true });
  }
  logger.info(`Seeded ${plans.length} plans`);
}

async function seedSchemaTypes() {
  for (const type of schemaTypes) {
    await SchemaType.updateOne({ name: type.name }, { $set: type }, { upsert: true });
  }
  logger.info(`Seeded ${schemaTypes.length} schema types`);
}

async function ensureUser({ email, password, name, role, accountType, plan, companyName }) {
  if (!email || !password) {
    logger.warn(`Skipping ${role} seed user: email/password not set in .env`);
    return null;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    logger.info(`User already exists: ${email}`);
    return existing;
  }

  const user = new User({
    name,
    email: email.toLowerCase(),
    password,
    role,
    accountType,
    plan,
    companyName: companyName ?? '',
    status: USER_STATUS.ACTIVE,
    scanCredits: role === ROLES.ADMIN ? 100000 : INITIAL_SCAN_CREDITS,
    onboarding: { completed: true, completedAt: new Date() },
  });
  await user.save();

  const planDoc = await Plan.findOne({ slug: plan });
  if (planDoc) {
    await Subscription.create({
      userId: user._id,
      planId: planDoc._id,
      status: SUBSCRIPTION_STATUS.ACTIVE,
      billingProvider: 'none',
      currentPeriodStart: new Date(),
    });
  }

  await CreditTransaction.create({
    userId: user._id,
    amount: user.scanCredits,
    type: 'grant',
    reason: 'Seed account credits',
    balanceBefore: 0,
    balanceAfter: user.scanCredits,
  });

  logger.info(`Created ${role} user: ${email}`);
  return user;
}

async function seedDemoProjects(owner) {
  if (!owner) return;

  for (const demo of demoProjects) {
    const { key, ...projectData } = demo;
    const normalizedDomain = normalizeDomain(demo.websiteUrl);

    const existing = await BusinessProject.findOne({ userId: owner._id, normalizedDomain });
    if (existing) continue;

    const project = await BusinessProject.create({
      ...projectData,
      normalizedDomain,
      userId: owner._id,
    });

    await BusinessData.create({
      projectId: project._id,
      identity: {
        businessName: project.businessName,
        businessType: project.businessType,
        websiteUrl: project.websiteUrl,
      },
      address: { addressCountry: project.country },
      confirmedFields: ['identity.businessName', 'identity.websiteUrl'],
    });

    if (demoLocations[key]) {
      for (const location of demoLocations[key]) {
        await Location.create({ ...location, projectId: project._id, userId: owner._id });
      }
    }

    logger.info(`Created demo project: ${project.projectName}`);
  }
}

async function run() {
  await connectDatabase();
  logger.info('Seeding database...');

  await seedPlans();
  await seedSchemaTypes();

  const admin = await ensureUser({
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    name: 'Platform Admin',
    role: ROLES.ADMIN,
    accountType: null,
    plan: PLAN_SLUGS.AGENCY,
    companyName: 'LocalSchema AI',
  });

  const demoUser = await ensureUser({
    email: env.DEMO_USER_EMAIL,
    password: env.DEMO_USER_PASSWORD,
    name: 'Dana Owner',
    role: ROLES.USER,
    accountType: 'local_business',
    plan: PLAN_SLUGS.FREE,
    companyName: 'Bella Vista Trattoria',
  });

  const demoAgency = await ensureUser({
    email: env.DEMO_AGENCY_EMAIL,
    password: env.DEMO_AGENCY_PASSWORD,
    name: 'Alex Agency',
    role: ROLES.AGENCY,
    accountType: 'seo_agency',
    plan: PLAN_SLUGS.AGENCY,
    companyName: 'Northstar SEO',
  });

  // The agency owner gets the demo projects, including the multi-location one.
  await seedDemoProjects(demoAgency ?? demoUser);

  logger.info('Seed complete.');
  await disconnectDatabase();
  process.exit(0);
}

run().catch(async (error) => {
  logger.error('Seed failed', { message: error.message, stack: error.stack });
  await disconnectDatabase();
  process.exit(1);
});
