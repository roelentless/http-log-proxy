FROM node:10

COPY ./package.json ./package-lock.json /app/
WORKDIR /app
RUN npm install

COPY . /app
COPY ./entrypoint.sh /
RUN chmod +x ./entrypoint.sh

CMD ["/bin/bash", "/entrypoint.sh"]