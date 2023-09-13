FROM node:slim

RUN mkdir /app
WORKDIR /app

# Install all the stuff
COPY creds.json /app

# Although this copies everything, the thing above ensures creds.json exists prior to building
COPY . /app
RUN npm i

EXPOSE 8080

ENTRYPOINT ["npm", "run", "build"]