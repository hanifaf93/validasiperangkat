FROM node:latest

ENV TZ="Asia/Jakarta"
ENV PS1="\u@\h:\w\\$"

WORKDIR /app

COPY . .

RUN npm install && npm install -g nodemon

COPY . .

EXPOSE 5000

CMD ["npm", "start"]