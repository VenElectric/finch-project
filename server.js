const express = require("express");
const app = express();
const finch = require("@tryfinch/finch-api");
const cors = require("cors");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jwt-simple");
const port = 3000;
const {
  client_id,
  client_secret,
  db_path,
  redirect,
  customer_name,
  customer_id,
  crypt_secret,
} = require("./config.js");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
// need docker to compose both client and server
// need to configure docker to talk between client and server
// configure docker dev?????
// set client url and server url in .env file

// get access token
// hash with bcrypt
// store in sqlite

// maybe we use a simple node server...ugh
// trying to connect this and vue is a lot for a non-paid gig LOL

// ENV should have
// - client id
// - client secret
// - bcrypt secret
// - client host
// - server host
// - redirect url
// - customer name
// - customer id


app.get("/connect", async (req, res) => {
  console.log("running connect")
  const client = new finch.Finch({
    clientID: client_id,
    clientSecret: client_secret,
  });
  try {
    const connectRes = await client.connect.sessions.new({
      products: ["company", "directory", "individual", "employment"],
      customer_id: customer_id,
      customer_name: customer_name,
      minutes_to_expire: 43200,
      sandbox: "finch",
      redirect_uri: redirect,
    });
    res.status(200); // hello
    res.send(connectRes.connect_url);
  } catch (err) {
    if (Reflect.has(err, "error")) {
      const errObj = err.error;
      if (Reflect.has(errObj, "finch_code")) {
        if (errObj["finch_code"] === "connection_already_exists") {
          const connID = errObj["context"]["connection_id"];
          const reAuth = await client.connect.sessions.reauthenticate({
            connection_id: connID,
            redirect_uri: redirect,
          });
          res.status(200);

          res.send(reAuth.connect_url);
        }
      } else {
        res.status(400);
      }
    }
  }
});

app.post("/access-token", async (req, res) => {
  console.log("running access token")
  const code = req.body["code"]; 

  const client = new finch.Finch({
    clientId: client_id,
    clientSecret: client_secret,
  });
  try {
    const access = await client.accessTokens.create({
      client_id: client_id,
      client_secret: client_secret,
      code,
    });
    console.log(access)
    const db = await open({
      filename: db_path, // fix these
      driver: sqlite3.Database,
    });

    await db.all(
      "INSERT INTO ACCESS (access_token) VALUES (?)",
      jwt.encode(access.access_token, crypt_secret),
    );
    res.status(200).json({entity_ids: access.entity_ids});
  } catch (err) {
    console.log("there was an error");
    res.status(400);
  }
});

app.get("/company", async (req, res) => {
  console.log("running company")
  open({
    filename: db_path, // fix these
    driver: sqlite3.Database,
  }).then((db) => {
    db.get("SELECT * from ACCESS limit 1")
      .then(({ access_token }) => {
        const token = `${jwt.decode(access_token, crypt_secret)}`;
        const client = new finch.Finch({
          accessToken: token,
        });

        client.hris.company
          .retrieve()
          .then((org) => {
            res.status(200).json(org);
          })
          .catch((err) => {
            console.log(err);
            res.status(400);
            // some error handling
          });
      })
      .catch((err) => console.log("There was an error fetching the DB"));
  });
});

app.post("/directory", async (req, res) => {
  console.log("running directory")
  const ids = req.body.ids
  console.log("directory ids: ",ids);
  open({
    filename: process.env.DB_PATH, // fix these
    driver: sqlite3.Database,
  }).then((db) => {
    db.get("SELECT * from ACCESS limit 1").then(async ({ access_token }) => {
      const token = `${jwt.decode(access_token, crypt_secret)}`;
      const client = new finch.Finch({
        accessToken: token,
      });
      const list = []

      for await (const ind of client.hris.directory.list({"entity_ids": ids})){
        list.push(ind)
      }
      res.status(200).json(list)
    });
  });
});

app.post("/individual", async (req, res) => {
  console.log("running individual")
  const id = req.body.id;
  open({
    filename: process.env.DB_PATH, // fix these
    driver: sqlite3.Database,
  }).then((db) => {
    db.get("SELECT * from ACCESS limit 1").then(async ({ access_token }) => {
      const token = `${jwt.decode(access_token, crypt_secret)}`;
      const client = new finch.Finch({
        accessToken: token,
      });
      const person = await client.hris.individuals.retrieveMany({"entity_ids": [id]})
      res.status(200).json(person.responses[0])
    });
  });
});

app.get("/employment", async (req, res) => {
  console.log("running employment")
  open({
    filename: process.env.DB_PATH, // fix these
    driver: sqlite3.Database,
  }).then((db) => {
    db.get("SELECT * from ACCESS limit 1").then(({ access_token }) => {
      const token = `${jwt.decode(access_token, crypt_secret)}`;
      const client = new finch.Finch({
        accessToken: token,
      });
      client.hris.employments
        .retrieveMany({ requests: [{ individual_id: "individual_id" }] }) // need to call individuals first here and then gather ids....
        .then((org) => {
          res.status(200);
          res.json(org);
        })
        .catch((err) => {
          console.log(err);
          res.status(400);
          // some error handling
        });
    });
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
  open({
    filename: process.env.DB_PATH,
    driver: sqlite3.Database,
  }).then((db) => {
    db.all(
      "CREATE TABLE IF NOT EXISTS ACCESS (access_token TEXT)",
    );
  });
});
