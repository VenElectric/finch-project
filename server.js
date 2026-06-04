const express = require("express");
const path = require("path");
const app = express();
const { randomUUID } = require("node:crypto");
const finch = require("@tryfinch/finch-api");
const cors = require("cors");

const db = require("better-sqlite3")("./db/database.db");
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
app.use(express.static("public"));


app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "./public", "index.html"));
});

app.get("/connect", async (req, res) => {
  console.log("running connect");
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
        res.status(500).send(err["error"]["message"]);
      }
    }
     else {
        res.status(500).send("Unhandled error")
      }
  }
});

app.get("/redirect", (req, res) => {
  res.sendFile(path.join(__dirname, "./public", "redirect.html"));
});

app.post("/access-token", async (req, res) => {
  console.log("running access token");
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

    const session = randomUUID();

    db.prepare("INSERT INTO ACCESS (session_id,access_token) VALUES (?,?)").run(
      session,
      jwt.encode(access.access_token, crypt_secret),
    );
    db.prepare("INSERT INTO ENTITIES (session_id,entity_ids) VALUES(?,?)").run(
      session,
      access.entity_ids,
    );

    res.status(200).json({ session });
  } catch (err) {
    res.status(500).send(err["error"]["message"]);
  }
});

app.get("/information", (req, res) => {
  res.sendFile(path.join(__dirname, "./public", "information.html"));
});

app.post("/payment", async (req, res) => {
  const session = req.body.session_id;

  const stmt = db.prepare(
    "SELECT access_token from ACCESS where session_id = ?",
  );
  const { access_token } = stmt.get(session);
  const token = `${jwt.decode(access_token, crypt_secret)}`;
  const client = new finch.Finch({
    accessToken: token,
  });
  client.hris.payments
    .list()
    .then((payments) => res.status(200))
    .catch((err) => {
      if (Reflect.has(err, "error")) {
        const code = err["error"]["code"];
        if (code == 403) {
          res
            .status(403)
            .send("Provider has not implemented the directory endpoint.");
        } else {
          res.status(code).send(err["error"]["message"]);
        }
      }
       else {
        res.status(500).send("Unhandled error")
      }
    });
});

app.post("/company", async (req, res) => {
  console.log("running company");
  const session = req.body.session_id;

  const stmt = db.prepare(
    "SELECT access_token from ACCESS where session_id = ?",
  );
  const { access_token } = stmt.get(session);
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
      if (Reflect.has(err, "error")) {
        const code = err["error"]["code"];
        if (code == 403) {
          res
            .status(403)
            .send("Provider does not implemented company endpoint.");
        } else {
          res.status(code).send(err["error"]["message"]);
        }
      }
       else {
        res.status(500).send("Unhandled error")
      }
    });
});

app.post("/directory", async (req, res) => {
  console.log("running directory");
  const session = req.body.session_id;
  const stmt = db.prepare(
    "SELECT access_token from ACCESS where session_id = ?",
  );
  const { access_token } = stmt.get(session);
  const token = `${jwt.decode(access_token, crypt_secret)}`;
  const client = new finch.Finch({
    accessToken: token,
  });

  const entityStmt = db.prepare(
    "SELECT entity_ids from ENTITIES where session_id = ?",
  );
  const result = entityStmt.get(session);

  client.hris.directory
    .list()
    .then((entities) => {
      res.status(200).json(entities.individuals);
    })
    .catch((err) => {
      if (Reflect.has(err, "error")) {
        const code = err["error"]["code"];
        if (code == 403) {
          res
            .status(403)
            .send("Provider has not implemented the directory endpoint.");
        } else {
          res.status(code).send(err["error"]["message"]);
        }
      }
       else {
        res.status(500).send("Unhandled error")
      }
    });
});

app.post("/individual", async (req, res) => {
  console.log("running individual");
  const session = req.body.session_id;
  const id = req.body.id;
  const stmt = db.prepare(
    "SELECT access_token from ACCESS where session_id = ?",
  );
  const { access_token } = stmt.get(session);
  const token = `${jwt.decode(access_token, crypt_secret)}`;
  const client = new finch.Finch({
    accessToken: token,
  });

  client.hris.individuals
    .retrieveMany({
      requests: [{ individual_id: id }],
    })
    .then((person) => {
      res.status(200).json(person.responses[0]);
    })
    .catch((err) => {
      if (Reflect.has(err, "error")) {
        const code = err["error"]["code"];
        if (code == 403) {
          res
            .status(403)
            .send("Provider has not implemented the individual endpoint.");
        } else {
          res.status(code).send(err["error"]["message"]);
        }
      }
      else {
        res.status(500).send("Unhandled error")
      }
    });
});

app.post("/employment", async (req, res) => {
  const session = req.body.session_id;
  const id = req.body.id;
  const stmt = db.prepare(
    "SELECT access_token from ACCESS where session_id = ?",
  );
  const { access_token } = stmt.get(session);
  const token = `${jwt.decode(access_token, crypt_secret)}`;
  const client = new finch.Finch({
    accessToken: token,
  });
  client.hris.employments
    .retrieveMany({ requests: [{ individual_id: id }] }) // need to call individuals first here and then gather ids....
    .then((org) => {
      res.status(200).json(org.responses[0]);
    })
    .catch((err) => {
      if (Reflect.has(err, "error")) {
        const code = err["error"]["code"];
        if (code == 403) {
          res
            .status(403)
            .send("Provider has not implemented the individual endpoint.");
        } else {
          res.status(code).send(err["error"]["message"]);
        }
      }
       else {
        res.status(500).send("Unhandled error")
      }
    });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);

  db.prepare(
    "CREATE TABLE IF NOT EXISTS ACCESS (session_id TEXT PRIMARY KEY,access_token TEXT)",
  ).run();

  db.prepare(
    `CREATE TABLE IF NOT EXISTS ENTITIES (session_id TEXCT,entity_ids BLOB,FOREIGN KEY (session_id) 
      REFERENCES ACCESS (session_id) 
         ON DELETE CASCADE 
         ON UPDATE NO ACTION)`,
  ).run();
});
