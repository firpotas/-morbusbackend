const express = require("express")
const cors = require("cors")
const mysql = require("mysql2")
const jwt = require("jsonwebtoken")
// require('dotenv').config()

const app = express()

const { DB_HOST, DB_NAME, DB_USER, DB_PASSWORD, SECRET_KEY } = process.env 

app.use(cors())
app.use(express.json())

app.post("/register", (request, response) => {
    const user = request.body.user


    const searchCommand = `
        SELECT * FROM Users
        WHERE email = ?
    `

    db.query(searchCommand, [user.email], (error, data) => {
        if(error) {
            console.log(error)
            return
        }

        if(data.length !== 0) {
            response.json({ message: "Já existe um usuário cadastrado com esse e-mail. Tente outro e-mail!", userExists: true })
            return
        }

        const insertCommand = `
            INSERT INTO Users(name, email, password)
            VALUES(?, ?, ?)
        `

        db.query(insertCommand, [user.name, user.email, user.password], (error) => {
            if(error) {
                console.log(error)
                return
            }

            response.json ({ message: "Usuário cadastrado com sucesso!" })
        })
    })
})

app.post("/login", (request, response) => {
    const user = request.body.user

    const searchCommand = `
        SELECT * FROM Users
        WHERE email = ?
    `

    db.query(searchCommand, [user.email], (error, data) => {
        if(error) {
            console.log(error)
            return
        }

        if (data.length === 0 ) {
            response.json({ message: "Não existe nenhum usuário cadastrado com esse e-mail! "})
            return
        }

        if (user.password === data[0].password) {
            const email = user.email
            const id = data[0].id
            const name = data[0].name

            const token = jwt.sign({ id, email, name }, SECRET_KEY, {expiresIn: "1h"})
            response.json ({ token, ok: true })
            return
        }

        response.json({ message: "Credenciais inválidas! Tente novamente "})
    })
})

app.get("/verify", (request, response) => {
    const token = request.headers.authorization

    jwt.verify(token, SECRET_KEY, (error, decoded) => {
        if(error) {
            response.json({ message: "Token inválido! Efetue o login novamente." })
            return
        }

        response.json({ ok: true })
    })
})

app.get("/getname", (request, response) => {
    const token = request.headers.authorization;

    const decoded = jwt.verify(token, SECRET_KEY);

    response.json({ name: decoded.name });
});

// Rota para salvar os pontos do jogador
app.post("/savepoints", (request, response) => {
    const { token, pontos } = request.body;

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        const userId = decoded.id;

        const insertCommand = `
            INSERT INTO Rankings (user_id, pontos)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE pontos = ?
        `;

        db.query(insertCommand, [userId, pontos, pontos], (error) => {
            if (error) {
                console.error(error);
                response.status(500).json({ message: "Erro ao salvar os pontos!" });
                return;
            }

            response.json({ message: "Pontos salvos com sucesso!" });
        });
    } catch (error) {
        response.status(401).json({ message: "Token inválido ou expirado!" });
    }
});

// Rota para atualizar os pontos do jogador
app.post("/update-points", (request, response) => {
    const { token, pontos } = request.body; // Recebe o token e os pontos do jogador

    if (!token) {
        return response.status(400).json({ message: "Token não fornecido!" });
    }

    // Verifica o token
    jwt.verify(token, SECRET_KEY, (err, decoded) => {
        if (err) {
            return response.status(401).json({ message: "Token inválido!" });
        }

        // Obtém o id do usuário a partir do token decodificado
        const userId = decoded.id;

        // Insere ou atualiza a pontuação do usuário na tabela 'ranking'
        const query = `
            INSERT INTO Rankings (user_id, pontos) 
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE pontos = ?;
        `;

        db.query(query, [userId, pontos, pontos], (err, result) => {
            if (err) {
                console.error("Erro ao atualizar pontos:", err);
                return response.status(500).json({ message: "Erro ao atualizar pontos" });
            }

            response.json({ message: "Pontos atualizados com sucesso!" });
        });
    });
});

// Rota para buscar o ranking (top 4 jogadores com mais pontos)
app.get("/ranking", (req, res) => {
    const query = `
        SELECT Users.name, Rankings.pontos 
        FROM Rankings 
        JOIN Users ON Rankings.user_id = Users.id 
        ORDER BY Rankings.pontos DESC 
        LIMIT 4
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error("Erro na consulta ao banco:", err);
            return res.status(500).json({ message: "Erro ao buscar dados do ranking." });
        }

        console.log("Dados do ranking:", results);  // Exibindo o resultado no console
        res.json(results);  // Enviando os dados para o frontend
    });
});

app.listen(3000, () => {
    console.log("Servidor rodando na porta 3000!")
})

const db = mysql.createPool({
    connectionLimit: 10,
    host: DB_HOST,
    database: DB_NAME,
    user: DB_USER,
    password: DB_PASSWORD
})