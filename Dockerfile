FROM node:6-alpine

EXPOSE 3000

COPY . /forumlooper/

WORKDIR /forumlooper

RUN npm install -g typescript
RUN npm install

RUN npm run-script compile

ENTRYPOINT ["npm","start"]