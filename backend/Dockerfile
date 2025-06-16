# backend/Dockerfile

FROM node:18

# Install udevadm and other dependencies
RUN apt-get update && apt-get install -y \
    udev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the source code
COPY . .

EXPOSE 5000

CMD ["npm", "run", "dev"]
