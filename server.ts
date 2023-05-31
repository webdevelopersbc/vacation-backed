import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import mysql from 'mysql';
import bcrypt from 'bcrypt';
import validator from 'validator';
import fs from 'fs';
import path from 'path'; 
import multer from 'multer';
const cors = require('cors');
 
 


const app = express();
const port = 3004;

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
app.use(cors());
app.use('/images', express.static('images'));




 
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
  const { firstName, lastName, email, password, role } = req.body;

  // Check if all fields are present
  if (!firstName || !lastName || !email || !password || !role) {
    return res.status(400).json({
      status: 400,
      message: 'All fields are mandatory.'
    });
  }

  // Validate email format
  if (!validator.isEmail(email)) {
    return res.status(400).json({
      status: 400,
      message: 'Invalid email format.'
    });
  }

  // Check if email is available
  connection.query('SELECT * FROM users WHERE email = ?', email, (err, results) => {
    if (err) {
      console.error('Error querying database:', err);
      return res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
        error: err
      });
    }

    if (results.length > 0) {
      return res.status(409).json({
        status: 409,
        message: 'Email already exists.'
      });
    }

    // Check password length
    if (password.length < 4) {
      return res.status(400).json({
        status: 400,
        message: 'Password must be at least 4 characters long.'
      });
    }

    // Hash the password
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        console.error('Error hashing password:', err);
        return res.status(500).json({
          status: 500,
          message: 'Internal Server Error',
          error: err
        });
      }

      const user: User = {
        firstName,
        lastName,
        email,
        password: hash,
        role
      };

      // Insert the user into the database
      connection.query('INSERT INTO users SET ?', user, (err, results) => {
        if (err) {
          console.error('Error inserting user into database:', err);
          return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            error: err
          });
        }

        const transformedUser = transformResponse(user);

        return res.status(200).json({
          status: 200,
          message: 'User registered successfully',
          user: transformedUser
        });
      });
    });
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
  




// 3 Vacation 

// File upload configuration using multer
const storage = multer.diskStorage({
  destination: 'images', // Destination folder for storing uploaded images
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// API
interface Vacation {
  destination: string;
  description: string;
  start_date: string;
  end_date: string;
  price: number;
  image: string;
}

// Store Vacation API
app.post('/vacations', upload.single('image'), (req: Request, res: Response) => {
  const { destination, description, start_date, end_date, price } = req.body;

  // Check if all fields are present
  if (!destination || !description || !start_date || !end_date || !price) {
    return res.status(400).json({
      status: 400,
      message: 'All fields are mandatory.'
    });
  }

  // Validate price range
  if (price < 0 || price > 10000) {
    return res.status(400).json({
      status: 400,
      message: 'Price must be a positive number not exceeding 10,000.'
    });
  }

  // Validate date range
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const currentDate = new Date();

  if (endDate < startDate || startDate < currentDate || endDate < currentDate) {
    return res.status(400).json({
      status: 400,
      message: 'Invalid date range. Start date should be before end date, and both dates should be in the future.'
    });
  }

  // Save the image on the server side
  const imageFile: Express.Multer.File | undefined = req.file; // Updated type declaration

  // Check if image file is provided
  if (!imageFile) {
    return res.status(400).json({
      status: 400,
      message: 'Image file is required.'
    });
  }

  const imageFolderPath = 'images'; // Folder path to save the images
  const imageName = imageFile.filename; // Get the filename with extension

  // Move the uploaded file to the designated folder
  fs.renameSync(imageFile.path, path.join(imageFolderPath, imageName));

  const vacation: Vacation = {
    destination,
    description,
    start_date,
    end_date,
    price,
    image: imageName
  };

  // Insert the vacation into the database
  connection.query('INSERT INTO vacation SET ?', vacation, (err, results) => {
    if (err) {
      console.error('Error inserting vacation into database:', err);
      return res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
        error: err
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'Vacation stored successfully'
    });
  });
});


 


// 4 follow unfollow vacation
app.post('/followers', (req, res) => {
  const { user_id, vacation_id } = req.query;
  const { status } = req.body;

  // Check if user_id and vacation_id are provided
  if (!user_id || !vacation_id) {
    return res.status(400).json({
      status: 400,
      message: 'Both user_id and vacation_id are required as query parameters.'
    });
  }

  // Check if status is provided
  if (!status) {
    return res.status(400).json({
      status: 400,
      message: 'The status field is required in the request body.'
    });
  }

  // Validate the status value (ensure it is either 'follow' or 'unfollow')
  const validStatuses = ['follow', 'unfollow'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      status: 400,
      message: 'Invalid status value. The status field must be either "follow" or "unfollow".'
    });
  }

  // Check if the record already exists in the database
  const selectQuery = ` SELECT * FROM followers WHERE user_id = ? AND vacation_id = ? `;
  const selectValues = [user_id, vacation_id];

  connection.query(selectQuery, selectValues, (selectErr, selectResults) => {
    if (selectErr) {
      console.error('Error retrieving follow/unfollow status:', selectErr);
      return res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
        error: selectErr
      });
    }

    if (selectResults.length > 0) {
      // Record already exists, update the status
      const updateQuery = `
        UPDATE followers SET status = ? WHERE user_id = ? AND vacation_id = ?
      `;
      const updateValues = [status, user_id, vacation_id];

      connection.query(updateQuery, updateValues, (updateErr, updateResults) => {
        if (updateErr) {
          console.error('Error updating follow/unfollow status:', updateErr);
          return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            error: updateErr
          });
        }

        return res.status(200).json({
          status: 200,
          message: 'Follow/Unfollow status updated successfully.'
        });
      });
    } else {
      // Record doesn't exist, insert a new record
      const insertQuery = `
        INSERT INTO followers (user_id, vacation_id, status)
        VALUES (?, ?, ?)
      `;
      const insertValues = [user_id, vacation_id, status];

      connection.query(insertQuery, insertValues, (insertErr, insertResults) => {
        if (insertErr) {
          console.error('Error storing follow/unfollow status:', insertErr);
          return res.status(500).json({
            status: 500,
            message: 'Internal Server Error',
            error: insertErr
          });
        }

        return res.status(200).json({
          status: 200,
          message: 'Follow/Unfollow status stored successfully.'
        });
      });
    }
  });
});




// 5 vacation List
app.get('/vacations-list', (req, res) => {
  // Retrieve all vacations from the database
  connection.query('SELECT * FROM vacation WHERE status=1', (err, vacationResults) => {
    if (err) {
      console.error('Error retrieving vacations from the database:', err);
      return res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
        error: err
      });
    }

    // Retrieve the followers count for each vacation
    const getFollowersCount = (vacationId: number) => {
      return new Promise<number>((resolve, reject) => {
        connection.query('SELECT COUNT(*) AS count FROM followers WHERE status = "follow" AND vacation_id = ?', vacationId, (err, followersResult) => {
          if (err) {
            reject(err);
          } else {
            const followersCount = followersResult[0]?.count || 0;
            resolve(followersCount);
          }
        });
      });
    };

    // Retrieve the array of user IDs who follow each vacation
    const getFollowersArray = (vacationId: number) => {
      return new Promise<number[]>((resolve, reject) => {
        connection.query('SELECT user_id FROM followers WHERE status = "follow" AND vacation_id = ?', vacationId, (err, followersResult) => {
          if (err) {
            reject(err);
          } else {
            const followersArray = followersResult.map((follower: any) => follower.user_id);
            resolve(followersArray);
          }
        });
      });
    };

    // Process each vacation and retrieve followers count and followers array
    const processVacations = async () => {
      const vacations: any[] = [];

      for (const vacation of vacationResults) {
        const followersCount = await getFollowersCount(vacation.id);
        const followersArray = await getFollowersArray(vacation.id);

        vacations.push({
          ...vacation,
          followersCount,
          followersArray
        });
      }

      return vacations;
    };

    // Call the function to process vacations
    processVacations()
      .then((vacations) => {
        return res.status(200).json({
          status: 200,
          message: 'Vacation list retrieved successfully',
          vacations
        });
      })
      .catch((err) => {
        console.error('Error retrieving followers count or followers array:', err);
        return res.status(500).json({
          status: 500,
          message: 'Internal Server Error',
          error: err
        });
      });
  });
});

 


// 6 Delete Vacation 

app.delete('/delete-vacations/:id', (req: Request, res: Response) => {
  const vacationId = req.params.id;

  // Update the status column of the vacation to 0
  connection.query('UPDATE vacation SET status = 0 WHERE id = ?', vacationId, (err, results) => {
    if (err) {
      console.error('Error updating vacation status:', err);
      return res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
        error: err
      });
    }

    if (results.affectedRows === 0) {
      // No vacation found with the given ID
      return res.status(404).json({
        status: 404,
        message: 'Vacation not found'
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'Vacation deleted successfully'
    });
  });
});









// 7 Get vacation from id 
 app.get('/vacations-by-id/:id', (req: Request, res: Response) => {
  const vacationId = req.params.id;

  // Retrieve the vacation with the given ID from the database
  connection.query('SELECT * FROM vacation WHERE id = ?', vacationId, (err, results) => {
    if (err) {
      console.error('Error retrieving vacation:', err);
      return res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
        error: err
      });
    }

    if (results.length === 0) {
      // No vacation found with the given ID
      return res.status(404).json({
        status: 404,
        message: 'Vacation not found'
      });
    }

    const vacation = results[0];

    return res.status(200).json({
      status: 200,
      message: 'Vacation retrieved successfully',
      data: vacation
    });
  });
});



 // 8 Update Vacation API
app.put('/update-vacations/:id', upload.single('image'), (req: Request, res: Response) => {
  const vacationId = req.params.id;
  const { destination, description, start_date, end_date, price, image } = req.body;

  // Check if all fields are present
  if (!destination || !description || !start_date || !end_date || !price) {
    return res.status(400).json({
      status: 400,
      message: 'All fields are mandatory.'
    });
  }

  // Validate price range
  if (price < 0 || price > 10000) {
    return res.status(400).json({
      status: 400,
      message: 'Price must be a positive number not exceeding 10,000.'
    });
  }

  // Validate date range
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);

  if (endDate < startDate) {
    return res.status(400).json({
      status: 400,
      message: 'Invalid date range. End date cannot be earlier than the start date.'
    });
  }

  // Prepare the updated vacation data
  const updatedVacation: any = {
    destination,
    description,
    start_date,
    end_date,
    price
  };

  // Check if image file is provided and not empty
  if (req.file && req.file.filename !== '') {
    const imageFile: Express.Multer.File = req.file;
    const imageName = imageFile.filename;
    updatedVacation.image = imageName;

    // Move the uploaded file to the designated folder
    fs.renameSync(imageFile.path, path.join('images', imageName));
  }

  // Update the vacation in the database
  connection.query('UPDATE vacation SET ? WHERE id = ?', [updatedVacation, vacationId], (err, results) => {
    if (err) {
      console.error('Error updating vacation:', err);
      return res.status(500).json({
        status: 500,
        message: 'Internal Server Error',
        error: err
      });
    }

    if (results.affectedRows === 0) {
      // No vacation found with the given ID
      return res.status(404).json({
        status: 404,
        message: 'Vacation not found'
      });
    }

    return res.status(200).json({
      status: 200,
      message: 'Vacation updated successfully'
    });
  });
});
























// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
