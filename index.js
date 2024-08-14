const express = require('express');
const mongoose = require('mongoose');
const bcrypt= require ('bcryptjs')
const User = require('./models/User') 
const cors = require('cors');
const jwt = require ('jsonwebtoken');
const Place = require('./models/Place.js');
const Booking = require('./models/Booking.js');
const download = require('image-downloader');
const port = 3000;
const multer = require('multer')
const fs = require('fs');
const path =require('path')
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config();
const bcryptSalt=bcrypt.genSaltSync(10);
const jwtSecret  = 'wfnejfoeevnioefje';

app.use(express.json());
app.use(cookieParser());
app.use('/uploads',express.static(__dirname+'/uploads'));
app.use(cors({
  credentials : true,
  origin: 'http://localhost:5173',
}));


mongoose.connect(process.env.MONGO_URL)
.then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB...', err));

// mongoose.connect('mongodb+srv://ayush156rawat:<password>@cluster0.hbzl9cc.mongodb.net/')


function getUserDataFromReq(req) {
  return new Promise((resolve, reject) => {
    jwt.verify(req.cookies.token, jwtSecret, {}, async (err, userData) => {
      if (err) throw err;
      resolve(userData);
    });
  });
}

app.get('/', (req, res) => {
  res.json('Hello, Express!');
});

app.post('/register', async (req, res) => {
  try{
  const {name,email,password}=req.body;
  const userDoc = await User.create({
    name,
    email,
    password:bcrypt.hashSync(password,bcryptSalt),
  })
    res.json(userDoc); 
  }catch (e) {
    res.status(422).json(e);
  }

});

app.post('/login', async (req, res) => {
  try{
  const {email,password}=req.body;
  const userDoc=await User.findOne({email});
  if (userDoc) {
    const passOK = bcrypt.compareSync(password,userDoc.password)
    if (passOK) {
      jwt.sign({email:userDoc.email,id:userDoc._id}, jwtSecret,{},(err,token)=>{
        if (err) throw err;
        res.cookie('token',token).json(userDoc)
      });
    }else{ 
      res.status(422).json('pass not ok');
  }
  }else{ res.json('not found');
    }} catch (error) {
      res.status(500).json({ error: 'Error logging in' });
}});

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  if (token) {
    jwt.verify(token, jwtSecret, {}, async (err, userData) => {
      if (err) return res.status(403).json({ error: 'Invalid token' });
      try {
        const userDoc = await User.findById(userData.id);
        if (userDoc) {
          const { name, email, _id } = userDoc;
          res.json({ name, email, _id });
        } else {
          res.status(404).json({ error: 'User not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Error retrieving profile' });
      }
    });
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
});
//changes in profile


app.post('/logout',(req,res) =>{
  res.cookie('token', '').json(true);
})

app.post('/upload-by-link', async (req,res) => {
  const {link} = req.body;
  const newName = 'photo' + Date.now() + '.jpg';
  await download.image({
    url: link,
    dest: __dirname+'/uploads/' +newName,
  });
  res.json(newName);
});

const photosMiddleware = multer({dest:'uploads/'});
app.post('/uploads',photosMiddleware.array('photos',100),async(req,res) => {
  const uploadedFiles = [];
  for(let i=0; i < req.files.length; i++){
    const {path,originalname} =req.files[i];
    const parts =originalname.split('.');
    const ext = parts[parts.length-1];
    const newPath=path + '.' + ext;
    fs.renameSync(path , newPath)
    uploadedFiles.push(newPath.replace('uploads/',''))
  }
  res.json(uploadedFiles)
})

app.post('/places',(req,res) => {
  const { token } = req.cookies;
  const {title, address, addedPhotos, description, perks, extraInfo,checkIn, checkOut, maxGuest,price}=req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
  if (err) throw err;
  const placeDoc = await Place.create({
    owner:userData.id,
    title, address, photos:addedPhotos, description, perks, extraInfo,checkIn, checkOut, maxGuest,price
  });
  res.json(placeDoc)
  })
});

app.get('/user-places',(req,res) => {
  const { token } = req.cookies;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const {id} =userData;
    res.json(await Place.find({owner:id}));
  })
});

app.get('/places/:id',async(req,res) => {
  const {id} = req.params;
  res.json(await Place.findById(id))
});

app.put('/places', async (req,res) => {
  const {token} = req.cookies;
  const {
    id, title,address,addedPhotos,description,
    perks,extraInfo,checkIn,checkOut,maxGuests,price,
  } = req.body;
  jwt.verify(token, jwtSecret, {}, async (err, userData) => {
    const placeDoc = await Place.findById(id);
    if (userData.id === placeDoc.owner.toString()) {
      placeDoc.set({
        title,address,photos:addedPhotos,description,
        perks,extraInfo,checkIn,checkOut,maxGuests,price,
      });
      await placeDoc.save();
      res.json('ok');
    }
  });
});

app.get('/places', async (req,res) => {
  res.json( await Place.find() );
});

app.post('/bookings', async (req, res) => {
  const userData = await getUserDataFromReq(req);
  const {
    place,checkIn,checkOut,numberOfGuests,name,phone,price,
  } = req.body;
  Booking.create({
    place,checkIn,checkOut,numberOfGuests,name,phone,price,
    user:userData.id,
  }).then((doc) => {
    res.json(doc);
  }).catch((err) => {
    throw err;
  });
});

app.get('/bookings', async (req,res) => {
  const userData = await getUserDataFromReq(req);
  res.json( await Booking.find({user:userData.id}).populate('place') );
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
   
