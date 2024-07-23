const fs = require('firebase-admin');
const serviceAccount = require('../config/key.json');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http')
const cors = require('cors');
const firebase = require("firebase/app");
const path = require('path');
const express = require('express');
const router = express.Router();
const fsExtra = require('fs-extra');
const db = fs.firestore();
const { formatDate, formatDateTime } = require('../utils/dateUtils');
router.use(express.urlencoded({ extended: true }));
router.use(express.json());

const secretKey = 'secret';
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const groupPicture = multer.diskStorage({
  destination: function (req, file, cb) {
      const groupId = req.groupId;
      const uploadPath = path.join(__dirname,'..', 'uploads', 'group', groupId, 'profilPic');
      fsExtra.ensureDirSync(uploadPath);
      cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
      cb(null, 'picture' + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const uploadGroupProfil = multer({ storage: groupPicture });

// Rute untuk login




// Endpoint untuk menambahkan rencana grup
router.post('/groups/:groupId/plans', upload.single('file'), async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, subjectId, title, dateReminder, timeReminder, dateDeadline, timeDeadline, notes } = req.body;

    // Mengonversi tanggal dan waktu menjadi timestamp
    const dateTimeReminder = new Date(`${dateReminder}T${timeReminder}`).getTime();
    const dateTimeDeadline = new Date(`${dateDeadline}T${timeDeadline}`).getTime();

    // Membuat rencana grup baru untuk groupId tertentu
    const groupPlanRef = await db.collection('groups').doc(groupId).collection('plans').add({
      title,
      type,
      subjectId,
      dateTimeReminder: new Date(dateTimeReminder),
      dateTimeDeadline: new Date(dateTimeDeadline),
      notes
    });

    res.status(200).json({ statusCode: '200', message: 'Group plan added successfully', id: groupPlanRef.id });
  } catch (error) {
    console.error('Error adding group plan:', error);
    res.status(500).json({ error: 'Failed to add group plan' });
  }
});

// Endpoint untuk mendapatkan semua rencana dari grup tertentu
// Fungsi untuk mendapatkan semua rencana grup untuk groupId tertentu
async function getGroupPlans(groupId) {
  const groupPlansSnapshot = await db.collection('groups').doc(groupId).collection('plans').get();
  
  const groupPlansList = [];
  
  const promises = groupPlansSnapshot.docs.map(async doc => {
    const data = doc.data();
    const formattedDateTimeDeadline = formatDateTime(data.dateTimeDeadline);
    const formattedDateTimeReminder = formatDateTime(data.dateTimeReminder);
    
    groupPlansList.push({
      id: doc.id,
      title: data.title,
      dateTimeReminder: formattedDateTimeReminder,
      dateTimeDeadline: formattedDateTimeDeadline,
      type: data.type,
      subjectId: data.subjectId,
      notes: data.notes
    });
  });
  
  await Promise.all(promises);
  
  return groupPlansList;
}

// Endpoint untuk mendapatkan semua rencana grup dari grup tertentu
router.get('/groups/:groupId/plans', async (req, res) => {
  try {
    const { groupId } = req.params;

    const groupPlansList = await getGroupPlans(groupId);

    res.status(200).json({ statusCode: '200', data: groupPlansList });
  } catch (error) {
    console.error('Error fetching group plans:', error);
    res.status(500).json({ error: 'Failed to fetch group plans' });
  }
});
  
// Endpoint untuk menambahkan jadwal grup
router.post('/groups/:groupId/schedules', async (req, res) => {
    try {
      const { groupId } = req.params;
      const { subject, sks, dosen, ruang, day, startTime, endTime, color } = req.body;
  
      // Membuat jadwal grup baru untuk grup dengan groupId tertentu
      const scheduleRef = await db.collection('groups').doc(groupId).collection('schedules').add({
        subject,
        sks,
        dosen,
        ruang,
        day,
        startTime,
        endTime,
        color
      });
  
      res.status(200).json({ statusCode: '200', message: 'Group schedule added successfully', id: scheduleRef.id });
    } catch (error) {
      console.error('Error adding group schedule:', error);
      res.status(500).json({ error: 'Failed to add group schedule' });
    }
  });

  // Endpoint untuk menambahkan time record grup
router.post('/groups/:groupId/time-records', async (req, res) => {
    try {
      const { groupId } = req.params;
      const { startTime, endTime, subject, type, title } = req.body;
  
      // Membuat time record baru untuk grup dengan groupId tertentu
      const timeRecordRef = await db.collection('groups').doc(groupId).collection('time_records').add({
        startTime,
        endTime,
        subject,
        type,
        title,
        date: formatDate(Date.now()) // Menambahkan kolom date dengan nilai Date.now()
      });
  
      res.status(201).json({ message: 'Time record added successfully', id: timeRecordRef.id });
    } catch (error) {
      console.error('Error adding time record:', error);
      res.status(500).json({ error: 'Failed to add time record' });
    }
  });
  
  // Endpoint untuk mendapatkan semua jadwal dari grup tertentu
router.get('/groups/:groupId/schedules', async (req, res) => {
    try {
      const { groupId } = req.params;
  
      // Mendapatkan referensi ke koleksi schedules dari grup dengan groupId tertentu
      const schedulesSnapshot = await db.collection('groups').doc(groupId).collection('schedules').get();
  
      if (schedulesSnapshot.empty) {
        return res.status(404).json({ error: 'No schedules found for this group' });
      }
  
      // Menyusun data jadwal dari hasil snapshot
      const schedules = schedulesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  
      res.status(200).json({ schedules });
    } catch (error) {
      console.error('Error getting group schedules:', error);
      res.status(500).json({ error: 'Failed to get group schedules' });
    }
  });


  // Endpoint untuk menambahkan time record grup
router.post('/groups/:groupId/time-records', async (req, res) => {
    try {
      const { groupId } = req.params;
      const { startTime, endTime, subject, type, title } = req.body;
  
      // Membuat time record baru untuk grup dengan groupId tertentu
      const timeRecordRef = await db.collection('groups').doc(groupId).collection('time_records').add({
        startTime,
        endTime,
        subject,
        type,
        title,
        date: formatDate(Date.now()) // Menambahkan kolom date dengan nilai Date.now()
      });
  
      res.status(201).json({ message: 'Time record added successfully', id: timeRecordRef.id });
    } catch (error) {
      console.error('Error adding time record:', error);
      res.status(500).json({ error: 'Failed to add time record' });
    }
  });

  // Endpoint untuk mendapatkan semua time record dari grup tertentu
router.get('/groups/:groupId/time-records', async (req, res) => {
    try {
      const { groupId } = req.params;
  
      // Mendapatkan referensi ke koleksi time_records dari grup dengan groupId tertentu
      const timeRecordsSnapshot = await db.collection('groups').doc(groupId).collection('time_records').get();
  
      if (timeRecordsSnapshot.empty) {
        return res.status(404).json({ error: 'No time records found for this group' });
      }
  
      // Menyusun data time record dari hasil snapshot
      const timeRecords = timeRecordsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
  
      res.status(200).json({ timeRecords });
    } catch (error) {
      console.error('Error getting group time records:', error);
      res.status(500).json({ error: 'Failed to get group time records' });
    }
  });
  
  

module.exports = router;
