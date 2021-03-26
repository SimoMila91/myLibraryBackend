const bodyParser = require('body-parser');
const mysql = require('mysql');
const express = require('express');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const port = 3000;

let db = mysql.createPool({
    host: 'localhost',
    user: 'simone',
    password: 'ciao',
    database: 'my_library',
    debug: false
});

const app = express();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
});

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
    res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Credentials", "TRUE");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    return next();

});

// REGISTER FUNCTION 
const register = function (req, res) {
    const password = req.body.psw;
    const email = req.body.email;
    const query = `
        SELECT email
        FROM Users
        WHERE email = '${email}'`;
    db.query(query, function (err, ress) {
        if (err) {
            res.status(500).send(err);
        } else {
            if (ress.length !== 0) {
                res.status(409).send('User already registered');
            } else {
                const hash = bcrypt.hashSync(password, saltRounds);
                const query = `
                    INSERT INTO Users(name, email, password)
                    VALUES('${req.body.name}', '${email}', '${hash}')`;
                db.query(query, function (error, results) {
                    if (error) {
                        res.status(500).send(error);
                    } else {
                        res.status(200).send("User registered successfully");
                    }
                });
            }
        }
    });
};

// LOGIN FUNCTION  

app.post("/login", (req, res) => {
    const password = req.body.psw;
    const query = `
        SELECT *
        FROM Users
        WHERE email =  '${req.body.email}'
    `;
    db.query(query, (error, results) => {
        if (error) {
            // se si è verificato un errore restitutisco errore e status 500
            res.status(500).send(error);
        } else {
            console.log(results);
            if (results.length === 0) {
                res.status(404).send('Incorrect login data. Try again.');
            } else {
                const hash = results[0].password;
                if (bcrypt.compareSync(password, hash)) {
                    const user = results[0];
                    console.log(user);
                    const token = uuid();
                    const expiry = new Date(new Date().getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
                    console.log(expiry);
                    const query = `
                        INSERT INTO Tokens VALUES('${token}','${expiry}', ${user.idUser})
                    `;
                    db.query(query, (err, ress) => {
                        if (err) {
                            res.status(500).send(err);
                        } else {
                            res.status(200).send({ token, string: `Welcome ${user.name}`, id: user.idUser });
                        }
                    });
                } else {
                    res.status(404).send("Password incorrect");
                }
            }
        }
    });
});

app.post("/logout", (req, res) => {
    console.log(req.body.token);
    const query = `
        DELETE FROM Tokens
        WHERE token = '${req.body.token}'`;

    db.query(query, (error, results) => {
        if (error) {
            res.status(500).send(error);
        } else {

            res.status(200).send('token eliminato');
        }
    });
});

const insBook = (req, res) => {
    const query = `
        INSERT INTO Books(title, author, plot, genre, publish_date, linkDownload, linkBuy, linkPreview, idUser)
        VALUES('${req.body.title}', '${req.body.title}', '${req.body.genre}', 
                '${req.body.publish_date}', '${req.body.linkDownload}', '${req.body.linkBuy}', '${req.body.linkPreview}', ${idUser})`;
    db.query(query, (err, ress) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send("Ok");
        }
    });
};

const checkCredentials = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization)
        return res.status(401).send("Invalid authorization header");
    const token = /^Bearer\s([0-9a-f\-]{36})$/.exec(authorization);
    if (!token || !token[1]) {
        return res.status(401).send("Invalid authorization header");
    }
    const query = `
    SELECT *
    FROM tokens
    WHERE token = '${token[1]}'`;

    db.query(query, (error, results) => {
        if (error) {
            return res.status(500).send(error);
        }
        if (!results[0]) {
            return res.status(401).send("Invalid token");
        }
        const date = new Date(results[0].expiry);
        const id = results[0].userId;
        if (date < new Date()) {
            const queryTwo = `
        DELETE FROM tokens WHERE userId = ${id}`;
            db.query(queryTwo, (error, results) => {
                if (error) {
                    return res.status(500).send(error);
                }
                return res.status(401).send('Token expired');
            });
        } else {
            next();
        }
    });
};

app.post("/signup", register);
app.post("/insert", checkCredentials, insBook);

app.listen(port, function () { console.log(`Server started at port: ${port}`) });