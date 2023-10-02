FROM node:latest

ENV TZ="Asia/Jakarta"
ENV PS1="\u@\h:\w\\$"

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY package.json .

RUN npm install

COPY app.js ./

EXPOSE 5000

CMD ["npm", "run", "dev"]