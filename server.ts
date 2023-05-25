import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql';
import bcrypt from 'bcrypt';


const app = express();
const port = 3000;

// MySQL connection configuration
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'vacation_backend'
});

// Connect to the MySQL database
connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL database:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

// Middleware
app.use(bodyParser.json());




//  API
// Setting
interface User {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: string;
  }
  
  function transformResponse(user: User): Omit<User, 'password'> {
    const { password, ...userData } = user;
    return userData;
  }
 


// 1 Register
app.post('/register', (req: Request, res: Response) => {
    const user = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role
    };
  
    // Hash the password
    bcrypt.hash(user.password, 10, (err, hash) => {
      if (err) {
        console.error('Error hashing password:', err);
        res.status(500).json({
          status: 500,
          message: 'Internal Server Error',
          error: err
        });
      } else {
        // Store the hashed password in the user object
        user.password = hash;
  
        // Insert the user into the database
        connection.query('INSERT INTO users SET ?', user, (err, results) => {
          if (err) {
            console.error('Error inserting user into database:', err);
            res.status(500).json({
              status: 500,
              message: 'Internal Server Error',
              error: err
            });
          } else {
            const transformedUser = transformResponse(user);

            res.status(200).json({
              status: 200,
              message: 'User registered successfully',
              user: transformedUser
            });
          }
        });
      }
    });
  });
  




// 2 Login 
app.post('/login', (req: Request, res: Response) => {
    const email = req.body.email;
    const password = req.body.password;
  
    // Retrieve the user from the database based on the email
    connection.query('SELECT * FROM users WHERE email = ?', email, (err, results) => {
      if (err) {
        console.error('Error retrieving user from database:', err);
        res.status(500).json({
          status: 500,
          message: 'Internal Server Error',
          error: err
        });
      } else if (results.length === 0) {
        res.status(404).json({
          status: 404,
          message: 'User not found'
        });
      } else {
        const user = results[0];
  
        // Compare the provided password with the hashed password stored in the database
        bcrypt.compare(password, user.password, (err, match) => {
          if (err) {
            console.error('Error comparing passwords:', err);
            res.status(500).json({
              status: 500,
              message: 'Internal Server Error',
              error: err
            });
          } else if (match) {
            // Passwords match, login successful
            const transformedUser = transformResponse(user);
            res.status(200).json({
              status: 200,
              message: 'Login successful',
              user: transformedUser
            });
          } else {
            // Passwords don't match, login failed
            res.status(401).json({
              status: 401,
              message: 'Incorrect password'
            });
          }
        });
      }
    });
  });
  






 

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
