const bodyParser = require('body-parser');
const mysql = require('mysql');
const express = require('express');
const axios = require('axios');
const bcrypt = require('bcrypt');
const faker = require('faker/locale/it');
const saltRounds = 10;
const port = process.env.PORT || 3000;

require('dotenv').config();

let db = mysql.createPool({
    host: process.env.HOST_NAME,
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: process.env.DATABASE,
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

app.get("/", (req, res) => {
  res.send("hello");
});

app.get("/read", (req, res) => {
    const id = parseInt(req.query.idUser);
    const index = parseInt(req.query.index);
    let query;
    let message;
    switch (index) {
        case 0:
            query = `
                SELECT t1.*
                FROM Books t1, UserBooks t2
                WHERE t2.idUser = ${id} AND t1.idBook = t2.idBook
            `;
            message = "There aren't books yet!";
            break;
        case 1:
            query = `
                SELECT t1.*
                FROM Books t1, UserBooks t2
                WHERE t2.idUser = ${id} AND t1.idBook = t2.idBook AND t2.type = ${1}
            `;
            message = "No books added here!";
            break;
        case 2:
            query = `
                SELECT t1.*
                FROM Books t1, UserBooks t2
                WHERE t2.idUser = ${id} AND t1.idBook = t2.idBook AND t2.type = ${0}
            `;
            message = "Maybe it's time to start reading something...";
            break;
        case 3:
            query = `
                SELECT t1.*
                FROM Books t1, UserBooks t2
                WHERE t2.idUser = ${id} AND t1.idBook = t2.idBook AND t2.favorite = ${1}
            `;
            message = "You haven't added any favorites yet";
            break;
    };

    db.query(query, (err, ress) => {
        if (err) {
            res.status(500).send(err);
            console.log(err);
        } else {
            res.status(200).send({ress, string: message});
        }
    })
});

app.delete("/deleteBook", (req, res) => {
  const idUser = parseInt(req.query.idUser);
  const query = `DELETE FROM UserBooks WHERE idBook = '${req.query.idBook}' AND idUser = ${idUser}`;
  db.query(query, (err, ress) => {
    if (err) throw err;
    console.log(`Number of records deleted: ${ress.affectedRows}`);
    res.status(200).send("eliminato");
  });
});

app.post("/getreviews", (req, res) => {
    const query = `SELECT * FROM Reviews WHERE idBook = '${req.body.idBook}' ORDER BY date`;
    db.query(query, (err, ress) => {
        if (err) {
            res.status(500).send(err);
        } else {
            const data = { 'reviews': []};
            for (let i = 0; i < ress.length; i++) {
                data.reviews[i] = {
                    name: ress[i].name,
                    review: ress[i].review,
                    date: ress[i].date,
                };
            };
            let count = data.reviews.length;
            let total =  count + 6;
            for (let i = count; i < total; i++) {
                data.reviews[i] = {
                    name: faker.name.findName(),
                    review: faker.lorem.text(),
                    date: faker.date.past(),
                };
            };
            res.status(200).send(data);
        }
    })
});

app.post("/forgotPassword", (req, res) => {
  if (req.body.email === '') {
    res.status(400).send('email required');
  }
  console.error(req.body.email);
  const query = `SELECT * FROM Users WHERE email = '${req.body.email}'`;

  db.query(query, (err, ress) => {
    if (ress.length === 0) {
      console.error('email required');
      res.status(403).send('email not in db');
    } else {
      if (ress[0].securityQuestion !== req.body.question) {
        res.status(401).send('Incorrect answer');
      } else {
        res.status(200).send('Correct answer');
      }
    }
  });
});

app.post("/reviews", (req, res) => {
    const query = `
        INSERT INTO Reviews(idBook, idUser, review, date, name)
        VALUE('${req.body.idBook}', ${parseInt(req.body.idUser)}, '${req.body.review}', '${req.body.date}', '${req.body.name}')
    `;
    db.query(query, (err, ress) => {
        if (err) {
            res.status(500).send(err);
        } else {
            res.status(200).send("Thank you for your review");
        }
    })
});

app.post("/articles", (req, res) => {
    let options = {
        method: 'GET',
        url: 'https://newscatcher.p.rapidapi.com/v1/search_free',
        params: {q: 'new book to read', lang: 'en', media: 'True'},
        headers: {
          'x-rapidapi-key': `${process.env.NEWS_API_KEY}`,
          'x-rapidapi-host': 'newscatcher.p.rapidapi.com'
        }
      };

      axios.request(options).then(function (response) {
          res.status(200).send(response.data);
      }).catch(function (error) {
          console.error(error);
          res.status(400).send(error);
      });
});

app.post("/newbook", (req, res) => {
    axios.get(`https://www.googleapis.com//books/v1/volumes?q=subject:${req.body.term}&maxResults=10&orderBy=newest&key=${process.env.GOOGLE_API_KEY}`)
    .then(ress => {
        res.status(200).send(ress.data.items);
    }).catch(err => {
        res.status(400).send(err);
    })
});

app.post("/books", (req, res) => {
    let typeChange = req.body.typeChange !== '' ? `&filter=${req.body.typeChange}` : '';
    const user = parseInt(req.body.idUser);
    axios.get(`https://www.googleapis.com/books/v1/volumes?q=${req.body.term}&langRestrict=${req.body.language}&maxResults=40${typeChange}&key=${process.env.GOOGLE_API_KEY}`)
        .then(ress => {
            if (ress.data.totalItems !== 0) {
                const query = `SELECT * FROM UserBooks WHERE idUser = ${user}`;
                db.query(query, function (error, results) {
                    if (error) {
                        console.log(error);
                    } else {
                        console.log(results);
                        // creo una nuova key favorite con valore boolean per sapere se tra i libri ci sono dei suoi favoriti o meno
                        const obj = ress.data.items;
                        for (let i = 0; i < results.length; i++) {
                            for (let k = 0; k < ress.data.items.length; k++) {
                                if (ress.data.items[k].id === results[i].idBook) {
                                    if(results[i].favorite === 1) {
                                        obj[k].favorite = true;
                                    } else {
                                        obj[k].favorite = false;
                                    }
                                }
                           }
                        }
                        res.status(200).send(obj);
                    }
                });
            } else {
                res.status(209).send(ress.data);
            };
        }).catch(err => { console.log(err)});

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
                    INSERT INTO Users(name, email, password, securityQuestion)
                    VALUES('${req.body.name}', '${email}', '${hash}', '${req.body.question}')`;
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

const changePassword = (req, res) => {
  const psw = req.body.psw;
  const hash = bcrypt.hashSync(psw, saltRounds);
  const query = `
    UPDATE User
    SET password = ${hash}
    WHERE idUser = ${req.body.idUser}
  `;
  db.query(query, (err, ress) => {
    if (err) {
      res.status(500).send(err);
    } else {
      res.status(200).send('Password updated');
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
                res.status(401).send('Incorrect login data. Try again.');
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
                            res.status(200).send({ token, string: `Welcome ${user.name}`, id: user.idUser, name: user.name });
                        }
                    });
                } else {
                    res.status(401).send("Password incorrect");
                }
            }
        }
    });
});

const deleteAccount = (req, res) => {
  const id =  req.body.idUser;
  let query = `DELETE t1.* t2.* t3.*
      FROM  Users t1, UserBooks t2, Tokens t3
      WHERE t1.idUser = ${id} AND t2.idUser = ${id} AND t3.idUser = ${id}
  `;
  db.query(query, (err, ress) => {
    if (err) {
      res.status(500).send(err);
    } else {
      console.log(ress);
    }
  });
};

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
    const type = req.body.type === 'read' ? 0 : 1;

    const query = `
        SELECT *
        FROM UserBooks
        WHERE idBook = '${req.body.idBook}'`;

    const queryTwo = `
        INSERT INTO UserBooks(idUser, idBook, type)
        VALUES(${req.body.idUser}, '${req.body.idBook}', ${type})`;

    db.query(query, (error, results) => {
        if (error) {
            res.status(500).send(error);
        } else {
            if (results.length === 0) {
              db.query(queryTwo, (err, ress) => {
                if (err) {
                  res.status(500).send(err);
                } else {
                  res.status(200).send(`Book successfully added as ${req.body.type}`);
                }
              });
            } else {
                let equal = false;
                for (let i = 0; i < results.length && !equal; i++) {
                    if (results[i].idUser == req.body.idUser && results[i].type === 1 || results[i].idUser == req.body.idUser && results[i].type === 0)
                        equal = true;
                }
                if (equal) {
                    res.status(409).send('Book already added. Check your personal page');
                } else {
                    const queryThree = `
                      UPDATE UserBooks
                      SET type = ${type}
                      WHERE idUser = ${req.body.idUser}
                    `;
                    db.query(queryThree, (errors, ress) => {
                        if (errors) {
                            res.status(500).send(errors);
                        } else {
                            res.status(200).send(`Book successfully added as: ${req.body.type}`);
                        }
                    });
                };
            };
        };
    });
};

const favorite = (req, res) => {
    const favorite = parseInt(req.body.favorite);
    const user = parseInt(req.body.idUser);
    console.log(typeof(favorite));
    const query = `
        SELECT *
        FROM UserBooks
        WHERE idBook = '${req.body.idBook}'
    `;
    db.query(query, (err, ress) => {
        if (err) {
            res.status(500).send(err);
        } else {
            if (ress.length !== 0) {
                let equal = false;
                for (let i = 0; i < ress.length && !equal; i++) {
                    console.log(ress[i].idBook + typeof(ress[i].idBook));
                    console.log(req.body.idBook + typeof(req.body.idBook));
                    if (ress[i].idUser === user) {
                        console.log('id uguale');
                        if (ress[i].idBook === req.body.idBook) {
                            console.log("book uguale");
                            equal = true;
                            console.log(equal);
                            console.log('si');
                        }
                    }
                };
                console.log(equal + " fine");
                if (equal) {
                    const queryTwo = `
                        UPDATE UserBooks
                        SET favorite = ${favorite}
                        WHERE idUser = ${user}
                        AND idBook = '${req.body.idBook}'
                    `;
                    db.query(queryTwo, (err, ress) => {
                        if (err) {
                            res.status(500).send(err);
                        } else {
                            const added = favorite === 1 ? 'added to' : 'deleted from'
                            res.status(200).send(`Successfully ${added} your favorites`);
                        }
                    });
                } else {
                  const insertUserBook = `INSERT INTO UserBooks(idUser, idBook, favorite) VALUE(${user}, '${req.body.idBook}', ${favorite})`;
                  db.query(insertUserBook, (err, ress) => {
                      if (err) {
                          res.status(500).send(err);
                      } else {
                          res.status(200).send("Successfully added to your favorites");
                      }
                  });
                }
            }
        }
    });
};

const checkBook = (req, res, next) => {
  const queryInsBook = `
  INSERT INTO Books(idBook, title, author, plot, linkImage, linkBuy, linkPdf, linkEpub, linkPreview, genre, publish_date)
  VALUES('${req.body.idBook}', '${req.body.title}', '${req.body.author}', '${req.body.plot}',
          '${req.body.linkImage}', '${req.body.linkBuy}', '${req.body.linkPdf}', '${req.body.linkEpub}',
          '${req.body.linkPreview}', '${req.body.genre}', '${req.body.publish_date}')
  `;
  const searchBook = `SELECT * FROM Books WHERE idBook = '${req.body.idBook}'`;

  db.query(searchBook, (err, ress) => {
    if (err) {
      console.log(err);
    } else {
      if (ress.length === 0) {
        db.query(queryInsBook, (error, results) => {
          if (error) {
            console.log(error);
          } else {
            console.log('book added');
          }
        });
      };
      next();
    };
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
    FROM Tokens
    WHERE token = '${token[1]}'`;

    db.query(query, (error, results) => {
        if (error) {
            return res.status(500).send(error);
        }
        if (!results[0]) {
            return res.status(401).send("Invalid token");
        }
        const date = new Date(results[0].expiry);
        const id = results[0].idUser;
        if (date < new Date()) {
            const queryTwo = `
        DELETE FROM Tokens WHERE idUser = ${id}`;
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

const checkPassword = (req, res, next) => {
  const password = req.body.psw;
  const idUser = req.body.idUser;
  const query = `SELECT * FROM Users WHERE idUser = ${idUser}`;
  db.query(query, (err, ress) => {
    if (err) {
      res.status(500).send(err);
    } else {
      const hash = ress[0].password;
      if (bcrypt.compareSync(password, hash)) {
        res.status(200).send('ok');
        next();
      } else {
        res.status(401).send('Incorrect password');
      }
    }
  });
};

app.put("/changePassword", changePassword);
app.delete("/deleteAccount", checkPassword, deleteAccount);
app.post("/signup", register);
app.post("/insert", checkCredentials, checkBook, insBook);
app.post("/favorite", checkCredentials, checkBook, favorite);

app.listen(port, function () { console.log(`Server started at port: ${port}`) });
