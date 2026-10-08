FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Build Next.js app
RUN npm run build

CMD ["npm", "start"]
