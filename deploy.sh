#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Cards Match Game Deployment Script ===${NC}"
echo -e "${BLUE}This script will help you deploy the application to Vercel and Supabase${NC}"
echo

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
  echo -e "${RED}Vercel CLI is not installed. Installing...${NC}"
  npm install -g vercel
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo -e "${RED}Supabase CLI is not installed. Installing...${NC}"
  npm install -g supabase
fi

echo -e "${GREEN}Step 1: Building the application${NC}"
npm run build

echo -e "${GREEN}Step 2: Deploying Supabase Edge Functions${NC}"
echo -e "${BLUE}Logging in to Supabase...${NC}"
supabase login

echo -e "${BLUE}Please enter your Supabase project reference:${NC}"
read -p "Project Ref: " PROJECT_REF

echo -e "${BLUE}Linking to Supabase project...${NC}"
supabase link --project-ref $PROJECT_REF

echo -e "${BLUE}Deploying topics-function...${NC}"
supabase functions deploy topics-function --project-ref $PROJECT_REF

echo -e "${GREEN}Step 3: Deploying to Vercel${NC}"
echo -e "${BLUE}Logging in to Vercel...${NC}"
vercel login

echo -e "${BLUE}Please enter your environment variables:${NC}"
read -p "NEXT_PUBLIC_SUPABASE_URL: " SUPABASE_URL
read -p "NEXT_PUBLIC_SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY
read -p "NEXT_PUBLIC_BASE_URL (your Vercel deployment URL): " BASE_URL

echo -e "${BLUE}Deploying to Vercel...${NC}"
vercel --prod \
  -e NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY \
  -e NEXT_PUBLIC_BASE_URL=$BASE_URL

echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${BLUE}Your application has been deployed to Vercel and Supabase Edge Functions.${NC}"
echo -e "${BLUE}Make sure to update your database schema in Supabase if needed.${NC}"
