FROM node:latest

ENV TZ="Asia/Jakarta"
ENV PS1="\u@\h:\w\\$"

WORKDIR /app

COPY . .

RUN run install

COPY . .

EXPOSE 5000

CMD ["npm", "start"]