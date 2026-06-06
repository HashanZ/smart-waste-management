# Database Setup Guide

The system uses **MongoDB** as its primary persistent document store. Follow these guidelines to set up MongoDB locally or in the cloud via MongoDB Atlas.

## 1. MongoDB Atlas (Recommended for Production)

1. Sign up for a free tier database at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas).
2. Create a cluster and set up a database user with read/write credentials.
3. Whitelist access from your deployment environments (e.g. EC2 instance IP or `0.0.0.0/0` for development).
4. Copy the connection string. It should look like:
   `mongodb+srv://<username>:<password>@cluster-name.mongodb.net/smartWaste?retryWrites=true&w=majority`
5. Place this connection string inside your backend and ML microservice `.env` configuration files as `MONGODB_URI`.

## 2. Local MongoDB Configuration

1. Install MongoDB Community Server on your local machine.
2. Start the MongoDB system service:
   - **Windows**: Run `services.msc` and verify that the `MongoDB Server` service is running.
   - **Linux**: Run `sudo systemctl start mongod`.
3. The default local host connection URL will be:
   `mongodb://127.0.0.1:27017/smartwaste`
