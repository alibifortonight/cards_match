#!/bin/bash

# Word Match Game Setup Script

echo "Setting up Word Match Game..."

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install Node.js and npm first."
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Check if .env.local exists, create if not
if [ ! -f .env.local ]; then
    echo "Creating .env.local file template..."
    cat > .env.local << EOL
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOL
    echo "Please update .env.local with your Supabase credentials."
fi

echo "Setup complete! You can now run the application with 'npm run dev'"
echo "Visit http://localhost:3000 in your browser once the server is running."
