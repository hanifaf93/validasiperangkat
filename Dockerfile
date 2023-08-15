FROM node:latest

ENV TZ="Asia/Jakarta"
ENV PS1="\u@\h:\w\\$"

WORKDIR /app

COPY .package.json .

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]