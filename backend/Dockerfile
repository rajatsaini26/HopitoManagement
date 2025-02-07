# Use Node.js image as base
FROM node:18

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the entire backend source code
COPY . .

# Expose port 5000
EXPOSE 5000

# Use nodemon for hot-reloading in development mode
CMD ["npm", "run", "dev"]
