# Bring sign-up and the energy panels over from Adrian-Website

The accounts and birthdate-energy work lives on a branch in Adrian-Website (`origin/claude/oracle-energy-birthdate-4HS3f`). It brings sign-up, the hologenetic profile, and the today and year energy panels. The plan is to merge that work into Mandala Codes.

## What is ready

The database is already provisioned (`mandalacodes-oracle`, APAC region) and wired in `wrangler.toml`, waiting for the schema.

## What is needed

A fresh Clerk instance for the mandalacodes domain, because Clerk publishable keys are locked to a domain. This is separate from the admin sign-in Clerk app.

## Order

This is Phase 1b. The basic admin sign-in (see clerk-launch.md) lands first; this accounts work comes after.
