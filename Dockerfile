FROM node:20
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
RUN npx playwright install chromium
EXPOSE 3000
CMD ["npm","start"]
