# Use Node.js image as base
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire frontend source code
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the React app in development mode
CMD ["npm", "start"]
