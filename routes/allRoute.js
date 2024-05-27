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
const multer = require('multer');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage });

// Rute untuk login


function formatDateTimeRaw(year, month, day, hours, minutes, second, milliseconds = '000000') {
  
    const formattedMonth = String(month).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
 
    return `${year}-${formattedMonth}-${formattedDay} ${hours}:${minutes}:${second}.${milliseconds}`;
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
  
  
  
  router.get('/profile/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
  
      const userData = await db.collection("users").doc(userId).get();
  
      if (!userData.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { username, fullname} = userData.data();

      res.status(200).json({ username, fullname});
    } catch(error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ error: 'Failed to fetch user data' });
    }
  });

  function formatDateYMD(dateString) {
    // Buat objek Date dari string tanggal
    const date = new Date(dateString);
    
    // Ambil tahun, bulan, dan tanggal dari objek Date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Gabungkan tahun, bulan, dan tanggal dalam format YYYY-MM-DD
    const formattedDate = `${year}-${month}-${day}`;
    
    return formattedDate;
  }

  router.get('/profile/edit/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
  
      const userData = await db.collection("users").doc(userId).get();
  
      if (!userData.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const { username, fullname, college, dob } = userData.data();
      console.log(dob);
  
      res.status(200).json({ username, fullname, college: college, dob: dob });
    } catch(error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ error: 'Failed to fetch user data' });
    }
  });

  router.post('/profile/edit/password/:userId', async (req, res) => {
    try {
      const { currentPassword, newPassword, password_confirmation } = req.body;
      const { userId } = req.params;
  
      // Mendapatkan data pengguna dari database
      const userDoc = await db.collection("users").doc(userId).get();
      
      if (!userDoc.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const userData = userDoc.data();
      const hashedPassword = userData.password;
      
      // Memeriksa apakah password yang dimasukkan oleh pengguna cocok dengan hash yang disimpan
      const passwordMatch = await bcrypt.compare(currentPassword, hashedPassword);
  
      if (!passwordMatch) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
   
  
      // Memeriksa apakah password baru sama dengan konfirmasi password baru
      if (newPassword !== password_confirmation) {
        return res.status(400).json({ error: 'New password and confirm password do not match' });
      }
  
      // Mengenkripsi password baru
      const newHashedPassword = await bcrypt.hash(newPassword, 10);
  
      // Melakukan pembaruan password
      await db.collection("users").doc(userId).update({
        password: newHashedPassword
      });
  
      res.status(200).json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ error: 'Failed to update password' });
    }
  });
  
  
  
  router.put('/profile/edit/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Mendapatkan data yang akan diubah dari body request
      const { username, fullname, college, dob } = req.body;
  
      // Mendapatkan dokumen pengguna
      const userDoc = db.collection("users").doc(userId);
  
      // Memeriksa apakah pengguna ada
      const userSnapshot = await userDoc.get();
      if (!userSnapshot.exists) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      // Data baru yang akan diupdate
      const newData = {};
      if (username) newData.username = username;
      if (fullname) newData.fullname = fullname;
      if (college) newData.college = college;
      if (dob) newData.dob = dob;
  
      // Melakukan update data pengguna
      await userDoc.update(newData);
  
      res.status(200).json({ message: 'User data updated successfully' });
    } catch(error) {
      console.error('Error updating user data:', error);
      res.status(500).json({ error: 'Failed to update user data' });
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
        const { startTime, endTime, subject, type } = req.body;
        
        // Membuat time record baru untuk user dengan userId tertentu
        const timeRecordRef = await db.collection('users').doc(userId).collection('time_records').add({
          startTime,
          endTime,
          subject,
          type,
          date: formatDate(Date.now()) // Menambahkan kolom date dengan nilai Date.now()
        });
    
        res.status(201).json({ message: 'Time record added successfully', id: timeRecordRef.id });
      } catch (error) {
        console.error('Error adding time record:', error);
        res.status(500).json({ error: 'Failed to add time record' });
      }
    });
    async function getSubjectNameById(userId, subjectId) {
      try {
        const subjectDoc = await db.collection('users').doc(userId).collection('schedules').doc(subjectId).get();
        if (subjectDoc.exists) {
          return subjectDoc.data().subject; // Asumsi bahwa nama mata pelajaran disimpan dalam field 'name'
        } else {
          throw new Error('Subject not found');
        }
      } catch (error) {
        console.error('Error fetching subject name:', error);
        throw error;
      }
    }
    

  // Endpoint untuk melihat time record user tertentu

  async function getTimeDifferenceInSeconds(startTime, endTime) {
    // Split waktu mulai dan waktu selesai menjadi array jam, menit, dan detik
    const startTimeParts = startTime.split(':');
    const endTimeParts = endTime.split(':');
  
    // Buat objek Date untuk waktu mulai dan waktu selesai
    const startDate = new Date(0, 0, 0, startTimeParts[0], startTimeParts[1], startTimeParts[2]); // 0, 0, 0 menandakan tanggal 1 Januari 1900
    const endDate = new Date(0, 0, 0, endTimeParts[0], endTimeParts[1], endTimeParts[2]);
  
    // Hitung perbedaan waktu dalam milidetik
    const differenceInMillis = endDate.getTime() - startDate.getTime();
  
    // Ubah perbedaan waktu dari milidetik ke detik dan kembalikan
    return Math.abs(Math.round(differenceInMillis / 1000)); // gunakan Math.abs untuk memastikan hasilnya positif
  }

  router.get('/users/:userId/time-records', async (req, res) => {
    try {
      const { userId } = req.params;
    
      // Mengambil semua time records untuk user dengan userId tertentu
      const timeRecordsSnapshot = await db.collection('users').doc(userId).collection('time_records').get();
      
      const timeRecords = [];
      const promises = timeRecordsSnapshot.docs.map(async (doc) => {
        const data = doc.data();
        const type = await getTimeRecordsType(data.type);
        const time = await getTimeDifferenceInSeconds(data.startTime,data.endTime);
        const color = await getColor(userId, data.subject);
        const subjectName = await getSubjectNameById(userId, data.subject);
        return { id: doc.id, ...data, color, subject: subjectName, time: time, type:type };
      });
  
      const timeRecordsWithColor = await Promise.all(promises);
    
      res.json(timeRecordsWithColor);
    } catch (error) {
      console.error('Error fetching time records:', error);
      res.status(500).json({ error: 'Failed to fetch time records' });
    }
  });

  router.get('/users/:userId/time-records/now', async (req, res) => {
    try {
      const { userId } = req.params;
    
      // Mendapatkan ID semester berlangsung
      const currentSemesterId = await getCurrentSemester(userId);
    
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
    
      // Mendapatkan daftar subjectId dari semester berlangsung
      const subjectIds = await getSubjectIdsBySemester(userId, currentSemesterId);
    
      if (subjectIds.length === 0) {
        return res.status(404).json({ error: 'No subjects found for the current semester' });
      }
    
      // Mendapatkan time-records berdasarkan daftar subjectId
      const timeRecords = await getTimeRecordsBySubjectIds(userId, subjectIds);
    
      res.status(200).json({ statusCode: '200', data: timeRecords });
    } catch (error) {
      console.error('Error fetching time records:', error);
      res.status(500).json({ error: 'Failed to fetch time records' });
    }
  });

  async function getSubjectIdsBySemester(userId, semesterId) {
    const subjectsSnapshot = await db.collection('users').doc(userId).collection('schedules')
      .where('semesterId', '==', semesterId)
      .get();
  
    const subjectIds = [];
    subjectsSnapshot.forEach(doc => {
      subjectIds.push(doc.id);
    });
  
    return subjectIds;
  }
  
  async function getTimeRecordsType(type){
    if (type == 1){
      return "Mengerjakan Tugas";
    }
    else if (type == 2){
      return "Belajar Mandiri";
    }
  }
  // Fungsi untuk mendapatkan time-records berdasarkan daftar subjectId
  async function getTimeRecordsBySubjectIds(userId, subjectIds) {
    const timeRecordsSnapshot = await db.collection('users').doc(userId).collection('time_records')
      .where('subject', 'in', subjectIds)
      .get();
  
    const timeRecords = [];
    const promises = timeRecordsSnapshot.docs.map(async (doc) => {
      const record = { id: doc.id, ...doc.data() };
      const type = await getTimeRecordsType(record.type);
      const time = await getTimeDifferenceInSeconds(record.startTime,record.endTime);
      const color = await getColor(userId, record.subject);
      const subjectName = await getSubjectNameById(userId, record.subject);
      return { id: doc.id, ...record, color, subject: subjectName, time: time, type:type };
    });
  
    return Promise.all(promises);
  }
  
  
  // Route untuk mendapatkan time-records dari semester tertentu
// Route untuk mendapatkan time-records dari semester tertentu atau semester berlangsung
router.get('/users/:userId/time-records/semester/:semesterId?', async (req, res) => {
  try {
    const { userId, semesterId } = req.params;

    // Jika semesterId null, dapatkan currentSemesterId
    const selectedSemesterId = semesterId || await getCurrentSemester(userId);

    if (!selectedSemesterId) {
      return res.status(400).json({ error: 'No current semester found' });
    }

    // Mendapatkan daftar subjectId dari semester tertentu
    const subjectIds = await getSubjectIdsBySemester(userId, selectedSemesterId);

    if (subjectIds.length === 0) {
      return res.status(404).json({ error: 'No subjects found for this semester' });
    }

    // Mendapatkan time-records berdasarkan daftar subjectId
    const timeRecords = await getTimeRecordsBySubjectIds(userId, subjectIds);

    res.status(200).json({ statusCode: '200', data: timeRecords });
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
  


  function getNamaHari(angkaHari) {
    const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    return namaHari[angkaHari];
  }

  async function getSchedules(userId, semesterId, firstDayWeek, lastDayWeek) {
    const schedulesSnapshot = await db.collection('users').doc(userId).collection('schedules')
      .where('semesterId', '==', semesterId)
      .get();
  
    const schedules = [];
    const promises = schedulesSnapshot.docs.map(async doc => {
      const scheduleData = { id: doc.id, ...doc.data() };
      // Konversi timestamp ke format yang lebih mudah dibaca jika perlu
      let daysInRange = await getDaysInRange(firstDayWeek, lastDayWeek, doc.data().day);
      const startTime = scheduleData.startTime;
      const endTime = scheduleData.endTime;
      const startTimeParts = startTime.split(":");
      const endTimeParts = endTime.split(":");
      scheduleData.day = getNamaHari(scheduleData.day);
      daysInRange = new Date(daysInRange);
      scheduleData.startTime = formatDateTimeRaw(daysInRange.getFullYear(), daysInRange.getMonth() + 1, daysInRange.getDate(), startTimeParts[0], startTimeParts[1], startTimeParts[2]);
      scheduleData.endTime = formatDateTimeRaw(daysInRange.getFullYear(), daysInRange.getMonth() + 1, daysInRange.getDate(), endTimeParts[0], endTimeParts[1], endTimeParts[2]);
      schedules.push(scheduleData);
    });
  
    await Promise.all(promises);
  
    return schedules;
  }
  
  // Fungsi untuk mendapatkan nama-nama jadwal berdasarkan userId dan semesterId
  async function getScheduleNames(userId, semesterId) {
    const schedulesSnapshot = await db.collection('users').doc(userId).collection('schedules')
      .where('semesterId', '==', semesterId)
      .get();
  
    const courseNames = [];
    schedulesSnapshot.forEach(doc => {
      const scheduleData = doc.data();
      courseNames.push(scheduleData.subject);
    });
  
    return courseNames;
  }
  
  // Route untuk mendapatkan jadwal kuliah berdasarkan semesterId atau current semester
  router.get('/users/:userId/jadwalKuliah/semester/:semesterId?', async (req, res) => {
    try {
      const { userId, semesterId } = req.params;
      const { firstDayWeek, lastDayWeek } = req.query;
  
      // Jika semesterId null, dapatkan currentSemesterId
      const selectedSemesterId = semesterId || await getCurrentSemester(userId);
  
      if (!selectedSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
  
      const schedules = await getSchedules(userId, selectedSemesterId, firstDayWeek, lastDayWeek);
  
      res.status(200).json({ statusCode: '200', data: schedules });
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });
  
  // Route untuk mendapatkan jadwal kuliah saat ini
  router.get('/users/:userId/jadwalKuliah/now', async (req, res) => {
    try {
      const { userId } = req.params;
      const { firstDayWeek, lastDayWeek } = req.query;
  
      // Mendapatkan ID semester berlangsung
      const currentSemesterId = await getCurrentSemester(userId);
  
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
  
      const schedules = await getSchedules(userId, currentSemesterId, firstDayWeek, lastDayWeek);
  
      res.status(200).json({ statusCode: '200', data: schedules });
    } catch (error) {
      console.error('Error fetching schedules:', error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  });
  
  // Route untuk mendapatkan nama-nama jadwal kuliah saat ini
  router.get('/users/:userId/jadwalKuliahNames/now', async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Mendapatkan ID semester berlangsung
      const currentSemesterId = await getCurrentSemester(userId);
  
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
  
      const courseNames = await getScheduleNames(userId, currentSemesterId);
  
      res.status(200).json({ statusCode: '200', data: courseNames });
    } catch (error) {
      console.error('Error fetching course names:', error);
      res.status(500).json({ error: 'Failed to fetch course names' });
    }
  });

  //Jadwal Kuliah Detail
  router.get('/users/:userId/jadwalKuliah/detail/:jadwalKuliahId', async (req, res) => {
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
  
  //Edit Jadwal Kuliah
  router.put('/users/:userId/jadwalKuliah/update/:jadwalKuliahId', async (req, res) => {
    try {
        const { userId, jadwalKuliahId } = req.params;
        const { subject, dosen, ruang, day, startTime, endTime, color } = req.body;

        // Mengonversi waktu menjadi timestamp

        // Update jadwal mata kuliah berdasarkan ID jadwal tertentu
        const scheduleRef = db.collection('users').doc(userId).collection('schedules').doc(jadwalKuliahId);
        const updateData = {};
        if (subject) updateData.subject = subject;
        if (dosen) updateData.dosen = dosen;
        if (ruang) updateData.ruang = ruang;
        if (day !== undefined) updateData.day = day;
        if (startTime) updateData.startTime = startTime;
        if (endTime) updateData.endTime = endTime;
        if (color) updateData.color = color;

        await scheduleRef.update(updateData);

        res.status(200).json({ statusCode: "200", message: 'Schedule updated successfully', id: jadwalKuliahId });
    } catch (error) {
        console.error('Error updating schedule:', error);
        res.status(500).json({ error: 'Failed to update schedule' });
    }
});

//delet jadwal kuliah
router.delete('/users/:userId/jadwalKuliah/delete/:jadwalKuliahId', async (req, res) => {
    try {
        const { userId, jadwalKuliahId } = req.params;

        // Hapus jadwal mata kuliah berdasarkan ID jadwal tertentu
        const scheduleRef = db.collection('users').doc(userId).collection('schedules').doc(jadwalKuliahId);
        await scheduleRef.delete();

        res.status(200).json({ statusCode: "200", message: 'Schedule deleted successfully', id: jadwalKuliahId });
    } catch (error) {
        console.error('Error deleting schedule:', error);
        res.status(500).json({ error: 'Failed to delete schedule' });
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

  router.get('/users/:userId/semesters', async (req, res) => {
    try {
      const { userId } = req.params;
  
      // Mengambil semua semester dari user dengan userId tertentu
      const semestersSnapshot = await db.collection('users').doc(userId).collection('semesters').get();
      const semesters = semestersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
      res.status(200).json({ statusCode: '200', message: 'Semesters retrieved successfully', semesters });
    } catch (error) {
      console.error('Error retrieving semesters:', error);
      res.status(500).json({ error: 'Failed to retrieve semesters' });
    }
  });
  
  function getDate(dateTime) {
    const date = new Date(dateTime);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Fungsi untuk mengambil waktu dari datetime
function getTime(dateTime) {
    const date = new Date(dateTime);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

  // Endpoint untuk menambahkan rencana mandiri
  router.post('/users/:userId/rencanaMandiri',upload.single('file'), async (req, res) => {
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
  
  
  async function getRencanaMandiri(userId, semesterId) {
    const rencanaMandiriSnapshot = await db.collection('users').doc(userId).collection('rencanaMandiri')
                                          .where('semesterId', '==', semesterId).get();
    
    const rencanaMandiriList = [];
    
    const promises = rencanaMandiriSnapshot.docs.map(async doc => {
      const data = doc.data();
      
      const color = await getColor(userId, data.subjectId);
      const formattedDateTimeDeadline = formatDateTime(data.dateTimeDeadline);
      const formattedDateTimeReminder = formatDateTime(data.dateTimeReminder);
      
      rencanaMandiriList.push({ id: doc.id, title: data.title, dateTimeReminder: formattedDateTimeReminder, dateTimeDeadline: formattedDateTimeDeadline, color });
    });
    
    await Promise.all(promises);
    
    return rencanaMandiriList;
  }


  router.get('/users/:userId/rencanaMandiri/', async (req, res) => {
    try {
      const { userId } = req.params;
      console.log("HOHOHO");
      const currentSemesterId = await getCurrentSemester(userId);
  
      if (!currentSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
      
      const rencanaMandiriList = await getRencanaMandiri(userId, currentSemesterId);
  
      res.status(200).json({ statusCode: '200', data: rencanaMandiriList });
    } catch (error) {
      console.error('Error fetching rencana mandiri:', error);
      res.status(500).json({ error: 'Failed to fetch rencana mandiri' });
    }
  });

  router.get('/users/:userId/rencanaMandiri/semester/:semesterId?', async (req, res) => {
    try {
      const { userId, semesterId } = req.params;
  
      // Jika semesterId null, dapatkan currentSemesterId
      const selectedSemesterId = semesterId || await getCurrentSemester(userId);
  
      if (!selectedSemesterId) {
        return res.status(400).json({ error: 'No current semester found' });
      }
  
      const rencanaMandiriList = await getRencanaMandiri(userId, selectedSemesterId);
  
      res.status(200).json({ statusCode: '200', data: rencanaMandiriList });
    } catch (error) {
      console.error('Error fetching rencana mandiri:', error);
      res.status(500).json({ error: 'Failed to fetch rencana mandiri' });
    }
  });

  async function getSemesterNumberById(userId, semesterId) {
    try {
      // Referensi ke koleksi semester di dalam dokumen user
      const semesterRef = db.collection('users').doc(userId).collection('semesters').doc(semesterId);
      
      // Mendapatkan dokumen semester
      const semesterDoc = await semesterRef.get();
    
      // Periksa apakah dokumen ada
      if (!semesterDoc.exists) {
        console.log('No such document!');
        return null;
      } else {
        // Mengembalikan nilai semesterNumber
        const data = semesterDoc.data();
        return data.semesterNumber;
      }
    } catch (error) {
      console.error('Error getting document:', error);
      return null;
    }
  }
  
  //Get Rencana Detail
  router.get('/users/:userId/rencanaMandiri/:rencanaMandiriId', async (req, res) => {
    try {
      
      const { userId, rencanaMandiriId } = req.params;
      console.log("HOHOHO");
      // Mendapatkan data rencana mandiri berdasarkan userId dan rencanaMandiriId
      const rencanaMandiriDoc = await db.collection('users').doc(userId).collection('rencanaMandiri').doc(rencanaMandiriId).get();
      
      // Memeriksa apakah rencana mandiri ditemukan
      if (!rencanaMandiriDoc.exists) {
        return res.status(404).json({ error: 'Rencana mandiri not found' });
      }
  
      // Mendapatkan data rencana mandiri
      const data = rencanaMandiriDoc.data();
      console.log(data);
      
      // Mendapatkan warna dari mata kuliah
      const color = await getColor(userId, data.subjectId);
      console.log(data.dateTimeReminder);
      // Mendapatkan tanggal dan waktu yang diformat
      const formattedDateTimeReminder = formatDateTime(data.dateTimeReminder);
      const formattedDateTimeDeadline = formatDateTime(data.dateTimeDeadline);
      const type = await getTimeRecordsType(data.type);
      const subject = await getSubjectNameById(userId, data.subjectId);
      const semester = await getSemesterNumberById(userId, data.semesterId);
      // Menyusun respons dengan seluruh data rencana mandiri, termasuk warna dan tanggal serta waktu yang diformat
      const responseData = {
        id: rencanaMandiriDoc.id,
        title: data.title,
        type: type,
        subjectId: subject,
        semesterId: semester,
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

   //Get Rencana Detail for Edit
   router.get('/users/:userId/rencanaMandiri/detail/:rencanaMandiriId', async (req, res) => {
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
      console.log(data.dateTimeReminder);
      // Mendapatkan tanggal dan waktu yang diformat
      const formattedDateTimeReminder = formatDateTime(data.dateTimeReminder);
      const formattedDateTimeDeadline = formatDateTime(data.dateTimeDeadline);
      console.log(formattedDateTimeDeadline);


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


  //Edit Rencana
  router.put('/users/:userId/rencanaMandiri/update/:rencanaMandiriId', async (req, res) => {
    try {
        const { userId, rencanaMandiriId } = req.params;
        const { type, subjectId, title, dateReminder, timeReminder, dateDeadline, timeDeadline, notes } = req.body;

        // Mendapatkan rencana mandiri yang akan diupdate
        const rencanaMandiriRef = db.collection('users').doc(userId).collection('rencanaMandiri').doc(rencanaMandiriId);
        const rencanaMandiriData = (await rencanaMandiriRef.get()).data();

        // Mengonversi tanggal dan waktu menjadi timestamp
        const dateTimeReminder = dateReminder && timeReminder ? new Date(`${dateReminder}T${timeReminder}`).getTime() : rencanaMandiriData.dateTimeReminder;
        const dateTimeDeadline = dateDeadline && timeDeadline ? new Date(`${dateDeadline}T${timeDeadline}`).getTime() : rencanaMandiriData.dateTimeDeadline;

        // Objek untuk menyimpan data yang akan diupdate
        const updateData = {};
        if (title) updateData.title = title;
        if (type) updateData.type = type;
        if (subjectId) updateData.subjectId = subjectId;
        if (dateReminder && timeReminder) updateData.dateTimeReminder = new Date(dateTimeReminder);
        if (dateDeadline && timeDeadline) updateData.dateTimeDeadline = new Date(dateTimeDeadline);
        if (notes) updateData.notes = notes;

        // Update rencana mandiri jika ada data yang diisi
        if (Object.keys(updateData).length > 0) {
            await rencanaMandiriRef.update(updateData);
        }

        res.status(200).json({ statusCode: "200", message: 'Rencana mandiri updated successfully', id: rencanaMandiriId });
    } catch (error) {
        console.error('Error updating rencana mandiri:', error);
        res.status(500).json({ error: 'Failed to update rencana mandiri' });
    }
});


//Delete Rencana
router.delete('/users/:userId/rencanaMandiri/delete/:rencanaMandiriId', async (req, res) => {
    try {
        const { userId, rencanaMandiriId } = req.params;

        // Hapus rencana mandiri berdasarkan ID rencana mandiri tertentu
        const rencanaMandiriRef = db.collection('users').doc(userId).collection('rencanaMandiri').doc(rencanaMandiriId);
        await rencanaMandiriRef.delete();

        res.status(200).json({ statusCode: "200", message: 'Rencana mandiri deleted successfully', id: rencanaMandiriId });
    } catch (error) {
        console.error('Error deleting rencana mandiri:', error);
        res.status(500).json({ error: 'Failed to delete rencana mandiri' });
    }
});



module.exports = router;
