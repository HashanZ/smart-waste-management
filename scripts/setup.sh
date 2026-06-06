#!/bin/bash

# Smart Waste Management System Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up Smart Waste Management System..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed. Please install npm."
        exit 1
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed. Please install Python 3.11 or higher."
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_warning "Docker is not installed. Docker is required for running the full stack."
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_warning "Docker Compose is not installed. Docker Compose is required for running the full stack."
    fi
    
    print_status "Requirements check completed."
}

# Install root dependencies
install_root_dependencies() {
    print_status "Installing root dependencies..."
    npm install
    print_status "Root dependencies installed."
}

# Setup backend
setup_backend() {
    print_status "Setting up backend..."
    cd backend
    
    # Install dependencies
    npm install
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_status "Creating .env file from example..."
        cp env.example .env
        print_warning "Please update the .env file with your actual configuration values."
    fi
    
    # Build the project
    npm run build
    
    cd ..
    print_status "Backend setup completed."
}

# Setup web dashboard
setup_web_dashboard() {
    print_status "Setting up web dashboard..."
    cd web-dashboard
    
    # Install dependencies
    npm install
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        print_status "Creating .env file..."
        cat > .env << EOF
REACT_APP_API_URL=http://localhost:3000
REACT_APP_WS_URL=http://localhost:3000
GENERATE_SOURCEMAP=false
EOF
    fi
    
    cd ..
    print_status "Web dashboard setup completed."
}

# Setup ML service
setup_ml_service() {
    print_status "Setting up ML service..."
    cd ml-service
    
    # Create virtual environment
    python3 -m venv venv
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install dependencies
    pip install -r requirements.txt
    
    cd ..
    print_status "ML service setup completed."
}

# Setup mobile app
setup_mobile_app() {
    print_status "Setting up mobile app..."
    cd mobile-app
    
    # Check if Flutter is installed
    if ! command -v flutter &> /dev/null; then
        print_warning "Flutter is not installed. Please install Flutter to work with the mobile app."
        return
    fi
    
    # Get Flutter dependencies
    flutter pub get
    
    cd ..
    print_status "Mobile app setup completed."
}

# Setup E2E tests
setup_e2e_tests() {
    print_status "Setting up E2E tests..."
    cd tests/e2e
    
    # Install dependencies
    npm install
    
    # Install Playwright browsers
    npx playwright install
    
    cd ../..
    print_status "E2E tests setup completed."
}

# Create necessary directories
create_directories() {
    print_status "Creating necessary directories..."
    
    # Create logs directory
    mkdir -p logs
    
    # Create uploads directory
    mkdir -p uploads
    
    # Create data directories for ML service
    mkdir -p ml-service/data
    mkdir -p ml-service/models
    
    print_status "Directories created."
}

# Main setup function
main() {
    echo "=========================================="
    echo "Smart Waste Management System Setup"
    echo "=========================================="
    
    check_requirements
    install_root_dependencies
    setup_backend
    setup_web_dashboard
    setup_ml_service
    setup_mobile_app
    setup_e2e_tests
    create_directories
    
    echo ""
    echo "=========================================="
    print_status "Setup completed successfully! 🎉"
    echo "=========================================="
    echo ""
    echo "Next steps:"
    echo "1. Update the .env files with your actual configuration"
    echo "2. Start the development servers:"
    echo "   - npm run dev (starts all services)"
    echo "   - npm run dev:backend (backend only)"
    echo "   - npm run dev:web (web dashboard only)"
    echo "   - npm run dev:ml (ML service only)"
    echo ""
    echo "3. Or use Docker:"
    echo "   - docker-compose up -d"
    echo ""
    echo "For more information, check the documentation in the docs/ folder."
}

# Run main function
main "$@"





































