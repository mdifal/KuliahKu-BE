const fs = require('firebase-admin');
const serviceAccount = require('../config/key.json');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http')
const cors = require('cors');
const firebase = require("firebase/app");

const express = require('express');
const router = express.Router();

const db = fs.firestore();

const secretKey = 'secret';

// Rute untuk login


function formatDateTimeRaw(year, month, day, hours, minutes, second, milliseconds = '000000') {
  
    const formattedMonth = String(month).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
 
    return `${year}-${formattedMonth}-${formattedDay} ${hours}:${minutes}:${second}.${milliseconds}`;
  }

async function getDaysInRange(startDate, endDate, day) {
    const days = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    
    // Loop melalui setiap tanggal di dalam rentang
    while (currentDate <= end) {
        // Periksa apakah hari tanggal saat ini sesuai dengan hari yang diinginkan
        if (currentDate.getDay() === day) {
            days.push(new Date(currentDate)); // Menyimpan tanggal jika sesuai dengan hari yang diinginkan
        }
        // Pindah ke tanggal berikutnya
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return days;
}

async function getCurrentSemester(userId) {
    // Mendapatkan tanggal hari ini
    const today = new Date();
    const todayTimestamp = today.getTime();
  
    // Mendapatkan semua semester untuk user dengan userId tertentu
    const semestersSnapshot = await db.collection('users').doc(userId).collection('semesters').get();
    let currentSemesterId = null;
  
    // Mengecek setiap semester
    semestersSnapshot.forEach(doc => {
      const semesterData = doc.data();
      const semesterStartDate = new Date(semesterData.startDate).getTime();
      const semesterEndDate = new Date(semesterData.endDate).getTime();
      
      // Jika tanggal hari ini berada di antara tanggal mulai dan tanggal berakhir semester
      if (todayTimestamp >= semesterStartDate && todayTimestamp <= semesterEndDate) {
        currentSemesterId = doc.id;
        return; // Keluar dari forEach jika sudah menemukan semester yang berlangsung
      }
    });
  
    return currentSemesterId;
  }
  
  
  router.get('/health', (req, res) => {
    try {
      // Implementasi logika health check di sini
      // Misalnya, Anda dapat memeriksa koneksi ke database atau sumber daya lainnya
      // Jika semuanya berfungsi dengan baik, kirim respons dengan status OK
      res.status(200).json({ status: 'OK' });
    } catch(error) {
      // Jika ada kesalahan dalam logika health check, kirim respons dengan status error
      res.status(500).json({ error: error.message });
    }
  });
  
  // Endpoint untuk login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;
  
      
      const userQuerySnapshot = await db.collection('users').where('username', '==', username).limit(1).get();
      if (userQuerySnapshot.empty) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
  
      // Ambil data user
      const userData = userQuerySnapshot.docs[0].data();
  
      // Periksa apakah password yang diberikan cocok dengan yang tersimpan di database
      const passwordMatch = await bcrypt.compare(password, userData.password);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }
  
  
      const token = jwt.sign({ email: userData.email }, secretKey, { expiresIn: '24h' });
      console.log(userData.email);
      // Login berhasil, kirim JWT sebagai respons
      console.log(token);
      res.json({ message: 'Login successful', token });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ error: 'Failed to login' });
    }
  });
  
  function isValidEmail(email) {
    // Regular expression untuk memeriksa format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  // Fungsi untuk memeriksa apakah email sudah terdaftar
  async function isEmailRegistered(email) {
    // Lakukan pengecekan di database atau sumber data lainnya
    const user = await db.collection('users').where('email', '==', email).get();
    return !user.empty; // Return true jika email sudah terdaftar, false jika tidak
  }
  
  // Fungsi untuk memeriksa apakah username sudah terdaftar
  async function isUsernameRegistered(username) {
    // Lakukan pengecekan di database atau sumber data lainnya
    const user = await db.collection('users').where('username', '==', username).get();
    return !user.empty; // Return true jika username sudah terdaftar, false jika tidak
  }
  
  router.post('/create', async (req, res) => {
    try {
      // Validasi email
      if (!isValidEmail(req.body.email)) {
        return res.status(400).json({ statusCode: "400", message: "Invalid email format" });
      }
  
      // Validasi apakah email sudah terdaftar
      if (await isEmailRegistered(req.body.email)) {
        return res.status(400).json({statusCode: "400", message: "Email is already registered" });
      }
  
      // Validasi apakah username sudah terdaftar
      if (await isUsernameRegistered(req.body.username)) {
        return res.status(400).json({statusCode: "400", message: "Username is already taken" });
      }
  
      // Check if password and password confirmation match
      if (req.body.password !== req.body.password_confirmation) {
        return res.status(400).json({ statusCode: "400", message: "Password and password confirmation do not match" });
      }
  
      // Encrypt the password
      const encrypted_password = await bcrypt.hash(req.body.password, 10);
      console.log(req.body);
      const id = req.body.email;
      const userJson = {
        email: req.body.email,
        password: encrypted_password,
        fullname: req.body.fullname,
        username: req.body.username
      };
      const usersDb = db.collection('users'); 
      const response = await usersDb.doc(id).set(userJson);
      res.status(200).json({statusCode: "200", message: "Registered Successfully" });
    } catch(error) {
      res.status(500).json({ statusCode: "500",message: error.message });
    }
  });
  
  
  
    router.get('/read/:id', async (req, res) => {
      try {
        const userRef = db.collection("users").doc(req.params.id);
        const response = await userRef.get();
        res.send(response.data());
      } catch(error) {
        res.send(error);
      }
    });
  
    router.post('/update', async(req, res) => {
      try {
        const id=req.body.id;
        const newFirstName = "hello world!";
        const userRef = await db.collection("users").doc(id)
        .update({
          firstName: newFirstName
        });
        res.send(userRef);
      } catch(error) {
        res.send(error);
      }
    });
  
    router.delete('/delete/:id', async (req, res) => {
      try {
        const response = await db.collection("users").doc(req.params.id).delete();
        res.send(response);
      } catch(error) {
        res.send(error);
      }
    })
  
    // Endpoint untuk menambahkan time record untuk user tertentu
  router.post('/users/:userId/time-records', async (req, res) => {
    try {
      const { userId } = req.params;
      const { startTime, endTime, subject, jenis } = req.body;
  
      // Membuat time record baru untuk user dengan userId tertentu
      const timeRecordRef = await db.collection('users').doc(userId).collection('time_records').add({
        startTime,
        endTime,
        subject,
        type
      });
  
      res.status(201).json({ message: 'Time record added successfully', id: timeRecordRef.id });
    } catch (error) {
      console.error('Error adding time record:', error);
      res.status(500).json({ error: 'Failed to add time record' });
    }
  });
  
  // Endpoint untuk melihat time record user tertentu
  router.get('/users/:userId/time-records', async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Mengambil semua time records untuk user dengan userId tertentu
      const timeRecordsSnapshot = await db.collection('users').doc(userId).collection('time_records').get();
      const timeRecords = [];
      timeRecordsSnapshot.forEach(doc => {
        timeRecords.push({ id: doc.id, ...doc.data() });
      });
  
      res.json(timeRecords);
    } catch (error) {
      console.error('Error fetching time records:', error);
      res.status(500).json({ error: 'Failed to fetch time records' });
    }
  });
  
  
  // Endpoint untuk menambahkan jadwal kuliah
  router.post('/users/:userId/jadwalKuliah', async (req, res) => {
    try {
      const { userId } = req.params;
      const { subject, dosen,ruang, day, startTime, endTime, color } = req.body;
      
      // Mendapatkan ID semester berlangsung
      const currentSemesterId = await getCurrentSemester(userId);
  
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
  
      // Mengonversi waktu menjadi timestamp
  
      // Membuat jadwal mata kuliah baru untuk user dengan userId tertentu
      const scheduleRef = await db.collection('users').doc(userId).collection('schedules').add({
        semesterId: currentSemesterId,
        subject,
        dosen,
        ruang,
        day,
        startTime,
        endTime,
        color 
      });
  
      res.status(200).json({ statusCode:"200", message: 'Schedule added successfully', id: scheduleRef.id });
    } catch (error) {
      console.error('Error adding schedule:', error);
      res.status(500).json({ error: 'Failed to add schedule' });
    }
  });
  
  
  router.get('/users/:userId/jadwalKuliah', async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Mengambil semua jadwal mata kuliah untuk user dengan userId tertentu
      const schedulesSnapshot = await db.collection('users').doc(userId).collection('schedules').get();
      const schedules = [];
      schedulesSnapshot.forEach(doc => {
        schedules.push({ id: doc.id, ...doc.data() });
      });
      
      res.status(200).json({statusCode : "200", data : schedules});
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });
  
  router.get('/users/:userId/jadwalKuliahSemester', async (req, res) => {
    try {
      const { userId } = req.params;
      const { semesterId, firstDayWeek, lastDayWeek } = req.query; // Mendapatkan semesterId dari query parameter
  
      // Mengambil semua jadwal mata kuliah untuk user dengan userId tertentu pada semester tertentu
      let schedulesCollection = db.collection('users').doc(userId).collection('schedules');
        

      // Jika ada filter semesterId
      if (semesterId) {
        schedulesCollection = schedulesCollection.where('semesterId', '==', semesterId);
      }
  
      const schedulesSnapshot = await schedulesCollection.get();
      const schedules = [];
      schedulesSnapshot.forEach(doc => {
        const scheduleData = { id: doc.id, ...doc.data() };
        // Konversi timestamp ke format yang lebih mudah dibaca jika perlu
  
        schedules.push(scheduleData);
      });
  
      res.status(200).json({statusCode : "200", data : schedules});
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });
  

  function getNamaHari(angkaHari) {
    const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return namaHari[angkaHari];
  }

  router.get('/users/:userId/jadwalKuliah/now', async (req, res) => {
    try {
      const { userId } = req.params;
      const { firstDayWeek, lastDayWeek } = req.query;
  
      // Mendapatkan ID semester berlangsung
      const currentSemesterId = await getCurrentSemester(userId);
  
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
  
      // Mengambil semua jadwal mata kuliah untuk user dengan userId tertentu pada semester berlangsung
      const schedulesSnapshot = await db.collection('users').doc(userId).collection('schedules')
        .where('semesterId', '==', currentSemesterId)
        .get();
  
      const schedules = [];
      const promises = schedulesSnapshot.docs.map(async doc => {
        const scheduleData = { id: doc.id, ...doc.data() };
        // Konversi timestamp ke format yang lebih mudah dibaca jika perlu
        var daysInRange = await getDaysInRange(firstDayWeek, lastDayWeek, doc.data().day);
       const startTime = scheduleData.startTime;

       const endTime = scheduleData.endTime;
       const startTimeParts = startTime.split(":");
       const endTimeParts = endTime.split(":");
        scheduleData.day = getNamaHari(scheduleData.day);
        daysInRange = new Date(daysInRange);
        console.log(daysInRange);
        // Format tanggal untuk startTime dan endTime
        scheduleData.startTime = formatDateTimeRaw(daysInRange.getFullYear(),daysInRange.getMonth()+1,daysInRange.getDate(),startTimeParts[0],startTimeParts[1],startTimeParts[2]);
        scheduleData.endTime = formatDateTimeRaw(daysInRange.getFullYear(),daysInRange.getMonth()+1,daysInRange.getDate(),endTimeParts[0],endTimeParts[1],endTimeParts[2]);
      
        schedules.push(scheduleData);
      });
      
      await Promise.all(promises);
  
      res.json({statusCode : '200',data: schedules});
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });
  
  
  
  router.get('/users/:userId/jadwalKuliahNames/now', async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Mendapatkan ID semester berlangsung
      const currentSemesterId = await getCurrentSemester(userId);
  
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }

      
  
      // Mengambil semua jadwal mata kuliah untuk user dengan userId tertentu dan semester yang sedang berlangsung
      const schedulesSnapshot = await db.collection('users').doc(userId).collection('schedules')
                                          .where('semesterId', '==', currentSemesterId).get();
  
      const courseNames = [];
      schedulesSnapshot.forEach(doc => {
        const scheduleData = doc.data();
        courseNames.push(scheduleData.subject);
      });
  
      res.json(courseNames);
    } catch (error) {
      console.error('Error fetching course names:', error);
      res.status(500).json({ error: 'Failed to fetch course names' });
    }
  });


  //Jadwal Kuliah Detail
  router.get('/users/:userId/jadwalKuliah/:jadwalKuliahId', async (req, res) => {
    try {
      const { userId, jadwalKuliahId } = req.params;
  
      // Mendapatkan data jadwal kuliah berdasarkan user ID dan ID jadwal kuliah
      const jadwalKuliahDoc = await db.collection('users').doc(userId).collection('schedules').doc(jadwalKuliahId).get();
  
      // Memeriksa apakah jadwal kuliah ditemukan
      if (!jadwalKuliahDoc.exists) {
        return res.status(404).json({ error: 'Jadwal kuliah not found' });
      }
  
      // Mendapatkan data jadwal kuliah
      const jadwalKuliahData = { id: jadwalKuliahDoc.id, ...jadwalKuliahDoc.data() };
  

      res.status(200).json({ statusCode: '200', data: jadwalKuliahData });
    } catch (error) {
      console.error('Error fetching jadwal kuliah:', error);
      res.status(500).json({ error: 'Failed to fetch jadwal kuliah' });
    }
  });
  
  
  
  
  router.post('/users/:userId/semesters', async (req, res) => {
    try {
      const { userId } = req.params;
      const { semesterNumber, startDate, endDate, sks } = req.body;
  
      // Membuat semester baru untuk user dengan userId tertentu
      const semesterRef = await db.collection('users').doc(userId).collection('semesters').add({
        semesterNumber,
        startDate,
        endDate,
        sks
      });
  
      res.status(201).json({statusCode : '200',  message: 'Semester added successfully', id: semesterRef.id });
    } catch (error) {
      console.error('Error adding semester:', error);
      res.status(500).json({ error: 'Failed to add semester' });
    }
  });
  
  // Endpoint untuk menambahkan rencana mandiri
  router.post('/users/:userId/rencanaMandiri', async (req, res) => {
    try {
      const { userId } = req.params;
      const { type, subjectId, title, dateReminder, timeReminder, dateDeadline, timeDeadline, notes } = req.body;
  
      // Mendapatkan ID semester berlangsung
      const currentSemesterId = await getCurrentSemester(userId);
  
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
  
      // Mengonversi tanggal dan waktu menjadi timestamp
      const dateTimeReminder = new Date(`${dateReminder}T${timeReminder}`).getTime();
      const dateTimeDeadline = new Date(`${dateDeadline}T${timeDeadline}`).getTime();
  
      // Membuat rencana mandiri baru untuk user dengan userId tertentu
      const rencanaMandiriRef = await db.collection('users').doc(userId).collection('rencanaMandiri').add({
        semesterId: currentSemesterId,
        title,
        type,
        subjectId,
        dateTimeReminder: new Date(dateTimeReminder),
        dateTimeDeadline: new Date(dateTimeDeadline),
        notes
      });
  
      res.status(200).json({statusCode : '200', message: 'Rencana mandiri added successfully', id: rencanaMandiriRef.id });
    } catch (error) {
      console.error('Error adding rencana mandiri:', error);
      res.status(500).json({ error: 'Failed to add rencana mandiri' });
    }
  });
  
  // Fungsi untuk mendapatkan warna dari subject
  async function getColor(userId, subjectId) {
    try {
      // Mendapatkan data mata kuliah berdasarkan subjectId
      const subjectDoc = await db.collection('users').doc(userId).collection('schedules').doc(subjectId).get();
      if (!subjectDoc.exists) {
        return null; // Mengembalikan null jika mata kuliah tidak ditemukan
      }
      // Mengambil warna dari mata kuliah
      return subjectDoc.data().color;
    } catch (error) {
      console.error('Error fetching color:', error);
      return null;
    }
  }
  
  function formatDateTime(dateTime) {
    // Mendapatkan komponen tanggal, bulan, tahun, jam, menit, dan detik
    const seconds = dateTime._seconds || 0;
    const milliseconds = dateTime._nanoseconds / 1000000 || 0;
    const date = new Date(seconds * 1000 + milliseconds);
  
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const secondsString = String(date.getSeconds()).padStart(2, '0');
    const millisecondsString = String(date.getMilliseconds()).padStart(3, '0');
  
    // Membuat string dengan format yang diinginkan
    return `${year}-${month}-${day} ${hours}:${minutes}:${secondsString}.${millisecondsString}`;
  }
  
  
  
  router.get('/users/:userId/rencanaMandiri', async (req, res) => {
    try {
      const { userId } = req.params;
      
      // Mendapatkan ID semester berlangsung
      const currentSemesterId = await getCurrentSemester(userId);
  
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
  
      // Mengambil daftar jadwal mandiri untuk user dengan userId tertentu dan semester yang sedang berlangsung
      const rencanaMandiriSnapshot = await db.collection('users').doc(userId).collection('rencanaMandiri')
                                            .where('semesterId', '==', currentSemesterId).get();
                                     
      const rencanaMandiriList = [];
  
      // Membuat array dari promise yang akan menunggu semua operasi asinkron selesai
      const promises = rencanaMandiriSnapshot.docs.map(async doc => {
        const data = doc.data();
       
        // Mendapatkan warna dari mata kuliah
        const color = await getColor(userId, data.subjectId);
        
        // Mengonversi format tanggal dan waktu
        const formattedDateTimeDeadline = formatDateTime(data.dateTimeDeadline);
        const formattedDateTimeReminder = formatDateTime(data.dateTimeReminder);
        
        // Menambahkan ke dalam array
        rencanaMandiriList.push({ id: doc.id, title: data.title, dateTimeReminder: formattedDateTimeReminder, dateTimeDeadline: formattedDateTimeDeadline, color });
      });
  
      // Menunggu semua promise selesai
      await Promise.all(promises);
  
      res.status(200).json({statusCode : '200', data:rencanaMandiriList});
    } catch (error) {
      console.error('Error fetching rencana mandiri:', error);
      res.status(500).json({ error: 'Failed to fetch rencana mandiri' });
    }
  });
  
  
  router.get('/users/:userId/rencanaMandiri/:rencanaMandiriId', async (req, res) => {
    try {
      const { userId, rencanaMandiriId } = req.params;
      
      // Mendapatkan data rencana mandiri berdasarkan userId dan rencanaMandiriId
      const rencanaMandiriDoc = await db.collection('users').doc(userId).collection('rencanaMandiri').doc(rencanaMandiriId).get();
      
      // Memeriksa apakah rencana mandiri ditemukan
      if (!rencanaMandiriDoc.exists) {
        return res.status(404).json({ error: 'Rencana mandiri not found' });
      }
  
      // Mendapatkan data rencana mandiri
      const data = rencanaMandiriDoc.data();
      
      // Mendapatkan warna dari mata kuliah
      const color = await getColor(userId, data.subjectId);
   
      // Mendapatkan tanggal dan waktu yang diformat
      const formattedDateTimeReminder = formatDateTime(data.dateTimeReminder);
      const formattedDateTimeDeadline = formatDateTime(data.dateTimeDeadline);
  
      // Menyusun respons dengan seluruh data rencana mandiri, termasuk warna dan tanggal serta waktu yang diformat
      const responseData = {
        id: rencanaMandiriDoc.id,
        title: data.title,
        type: data.type,
        subjectId: data.subjectId,
        semesterId: data.semesterId,
        dateTimeReminder: formattedDateTimeReminder,
        dateTimeDeadline: formattedDateTimeDeadline,
        notes: data.notes,
        color
      };
  
      res.status(200).json({statusCode : '200', data : responseData});
    } catch (error) {
      console.error('Error fetching rencana mandiri:', error);
      res.status(500).json({ error: 'Failed to fetch rencana mandiri' });
    }
  });

module.exports = router;
