import React, { useState, useEffect, useCallback } from 'react';
import { Check, Plus, Minus, Calendar, Target, TrendingUp, Play } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection } from 'firebase/firestore';

// Helper to format date to YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to get day of week from date (0=Sunday, 1=Monday, ..., 6=Saturday)
const getDayOfWeek = (date) => {
  return new Date(date).getDay();
};

const GymTracker = () => {
  // State for Firebase
  const [firebaseApp, setFirebaseApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  // Set to true and false initially for local dev/deployment without full Firebase config
  const [isAuthReady, setIsAuthReady] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // State for selected date and workout data
  const [selectedDate, setSelectedDate] = useState(new Date());
  // workoutData will now be keyed by 'YYYY-MM-DD' strings
  const [workoutData, setWorkoutData] = useState({});

  // Exercise database with images and videos
  const exerciseMedia = {
    "Leg Press": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/legpress.jpeg",
      videoId: "qCR9bN3G1t4"
    },
    "Glute Kickback Machine": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Glute%20Kickback%20Machine.png",
      videoId: "aFoHAEx7UAs"
    },
    "Seated Leg Curl": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Seated%20Leg%20Curl.jpeg",
      videoId: "x7PRWgaZyYw"
    },
    "Hip Abduction": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Hip%20Abduction.png",
      videoId: "G_8LItOiZ0Q"
    },
    "Hip Adduction": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Hip%20Adduction.png",
      videoId: "riEMreTHNbM"
    },
    "Step-ups": {
      image: "https://cdn.pixabay.com/photo/2017/08/07/14/02/people-2604149_1280.jpg",
      videoId: "dQqApCGd5Ss"
    },
    "Glute Bridge": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Glute%20Bridge.png",
      videoId: "Xp33YgPZgns"
    },
    "Bulgarian Split Squats": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Bulgarian%20Split%20Squats.jpeg",
      videoId: "J1PEjNVe7po"
    },
    "Cable Glute Kickbacks": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Cable%20Glute%20Kickbacks.png",
      videoId: "n-cgsNePyFo"
    },
    "Walking Lunges": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Walking%20Lunges.png",
      videoId: "tQNktxPkSeE"
    },
    "Ab Machine": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/Ab%20Machine.png",
      videoId: "7T0ZUEt1m8s"
    },
    "Plank": {
      image: "https://49738047.fs1.hubspotusercontent-na1.net/hubfs/49738047/Donna/plank.png",
      videoId: "pvIjsG5Svck"
    }
  };

  // Function to get YouTube video URL
  const getYoutubeVideoUrl = (videoId) => {
    return `https://www.youtube.com/watch?v=${videoId}`;
  };

  // Workout plan structure - static plan for each day of the week
  const workoutPlan = {
    1: { // Monday
      title: "Lower Body Circuit",
      subtitle: "Tone legs, activate glutes, burn fat",
      duration: "30-35 min",
      exercises: [
        { name: "Leg Press", sets: 3, reps: 15, type: "weight" },
        { name: "Glute Kickback Machine", sets: 3, reps: 12, note: "each leg", type: "weight" },
        { name: "Seated Leg Curl", sets: 3, reps: 15, type: "weight" },
        { name: "Hip Abduction", sets: 3, reps: 15, note: "outer thighs", type: "weight" },
        { name: "Hip Adduction", sets: 3, reps: 15, note: "inner thighs", type: "weight" },
        { name: "Step-ups", sets: 2, reps: 12, note: "optional", type: "bodyweight" }
      ]
    },
    2: { // Tuesday
      title: "Glute & Core Focus",
      subtitle: "Build strength and stability",
      duration: "30-35 min",
      exercises: [
        { name: "Glute Bridge", sets: 3, reps: 12, note: "bodyweight or barbell", type: "weight" },
        { name: "Bulgarian Split Squats", sets: 2, reps: 10, note: "each leg", type: "bodyweight" },
        { name: "Cable Glute Kickbacks", sets: 3, reps: 15, type: "weight" },
        { name: "Walking Lunges", sets: 2, reps: 12, note: "optional", type: "bodyweight" },
        { name: "Ab Machine", sets: 2, reps: 15, type: "weight" },
        { name: "Plank", sets: 2, reps: 30, note: "seconds", type: "time" }
      ]
    },
    3: { // Wednesday
      title: "Lower Body Circuit",
      subtitle: "Tone legs, activate glutes, burn fat",
      duration: "30-35 min",
      exercises: [
        { name: "Leg Press", sets: 3, reps: 15, type: "weight" },
        { name: "Glute Kickback Machine", sets: 3, reps: 12, note: "each leg", type: "weight" },
        { name: "Seated Leg Curl", sets: 3, reps: 15, type: "weight" },
        { name: "Hip Abduction", sets: 3, reps: 15, note: "outer thighs", type: "weight" },
        { name: "Hip Adduction", sets: 3, reps: 15, note: "inner thighs", type: "weight" },
        { name: "Step-ups", sets: 2, reps: 12, note: "optional", type: "bodyweight" }
      ]
    },
    4: { // Thursday
      title: "Glute & Core Focus",
      subtitle: "Build strength and stability",
      duration: "30-35 min",
      exercises: [
        { name: "Glute Bridge", sets: 3, reps: 12, note: "bodyweight or barbell", type: "weight" },
        { name: "Bulgarian Split Squats", sets: 2, reps: 10, note: "each leg", type: "bodyweight" },
        { name: "Cable Glute Kickbacks", sets: 3, reps: 15, type: "weight" },
        { name: "Walking Lunges", sets: 2, reps: 12, note: "optional", type: "bodyweight" },
        { name: "Ab Machine", sets: 2, reps: 15, type: "weight" },
        { name: "Plank", sets: 2, reps: 30, note: "seconds", type: "time" }
      ]
    },
    5: { // Friday
      title: "Lower Body Circuit",
      subtitle: "Tone legs, activate glutes, burn fat",
      duration: "30-35 min",
      exercises: [
        { name: "Leg Press", sets: 3, reps: 15, type: "weight" },
        { name: "Glute Kickback Machine", sets: 3, reps: 12, note: "each leg", type: "weight" },
        { name: "Seated Leg Curl", sets: 3, reps: 15, type: "weight" },
        { name: "Hip Abduction", sets: 3, reps: 15, note: "outer thighs", type: "weight" },
        { name: "Hip Adduction", sets: 3, reps: 15, note: "inner thighs", type: "weight" },
        { name: "Step-ups", sets: 2, reps: 12, note: "optional", type: "bodyweight" }
      ]
    },
    // Weekends are rest days by default, or you can add plans for them
    0: { // Sunday
      title: "Rest Day",
      subtitle: "Recover and recharge",
      duration: "N/A",
      exercises: []
    },
    6: { // Saturday
      title: "Rest Day",
      subtitle: "Active recovery or rest",
      duration: "N/A",
      exercises: []
    }
  };

  const currentWorkout = workoutPlan[getDayOfWeek(selectedDate)];

  // Initialize Firebase and set up authentication listener
  useEffect(() => {
    // Determine if running in the Canvas environment by checking for specific global variables
    // These variables are injected by the Canvas runtime.
    const isCanvasEnvironment = (
      typeof window !== 'undefined' &&
      typeof window.__firebase_config !== 'undefined' &&
      typeof window.__app_id !== 'undefined' &&
      typeof window.__initial_auth_token !== 'undefined'
    );

    let firebaseConfig = {};
    let currentAppId = 'default-local-app-id'; // Default ID for local development/deployment

    if (isCanvasEnvironment) {
      try {
        firebaseConfig = JSON.parse(window.__firebase_config);
        currentAppId = window.__app_id;
      } catch (e) {
        console.error("Failed to parse __firebase_config from Canvas:", e);
        // Fallback to empty config if parsing fails
        firebaseConfig = {};
      }
    } else {
      // FOR LOCAL DEVELOPMENT/DEPLOYMENT WITHOUT FIREBASE PERSISTENCE:
      // If you want Firebase persistence, replace this block with your actual Firebase config.
      // You'll need to create a Firebase project at console.firebase.google.com
      // and get your config from Project settings -> General -> Your apps -> Firebase SDK snippet (Config)
      /*
      firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT_ID.appspot.com",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID" // This should match your Firebase project's app ID
      };
      currentAppId = firebaseConfig.projectId || 'your-firebase-project-id'; // Use your Firebase project ID here
      */
      console.warn("Running outside Canvas. Firebase config and app ID might be missing. Data persistence will not work unless you provide your own Firebase config.");
      setIsLoading(false); // Stop loading as Firebase won't initialize
      setUserId(crypto.randomUUID()); // Provide a local UUID for UI display
      setIsAuthReady(true); // Mark auth as ready for basic UI
      return; // Exit useEffect if no Firebase config is provided locally
    }

    let app;
    if (Object.keys(firebaseConfig).length > 0) {
      app = initializeApp(firebaseConfig);
      setFirebaseApp(app);
      const firestoreDb = getFirestore(app);
      setDb(firestoreDb);
      const firebaseAuth = getAuth(app);
      setAuth(firebaseAuth);

      const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Only attempt signInWithCustomToken if in Canvas and token is defined
          if (isCanvasEnvironment && typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
            try {
              await signInWithCustomToken(firebaseAuth, window.__initial_auth_token);
            } catch (error) {
              console.error("Error signing in with custom token:", error);
              await signInAnonymously(firebaseAuth);
            }
          } else {
            await signInAnonymously(firebaseAuth);
          }
          setUserId(firebaseAuth.currentUser?.uid || crypto.randomUUID());
        }
        setIsAuthReady(true); // Auth is ready, can now fetch/save data
      });
      return () => unsubscribe();
    } else {
      console.warn("Firebase config is empty. Firebase services will not be initialized.");
      setIsLoading(false);
      setIsAuthReady(true); // Treat as ready even without Firebase for basic functionality
      setUserId(crypto.randomUUID()); // Ensure userId is set even if Firebase isn't
    }
  }, []);

  // Fetch workout data from Firestore when auth is ready and userId is available
  useEffect(() => {
    // Only proceed if db, userId, and auth are ready, and we are in a Firebase-enabled state
    if (db && userId && isAuthReady && firebaseApp) { // firebaseApp check ensures Firebase was actually initialized
      setIsLoading(true);
      // Use the currentAppId determined during Firebase initialization
      const currentAppId = (typeof window !== 'undefined' && typeof window.__app_id !== 'undefined') ? window.__app_id : 'default-local-app-id';
      const userWorkoutsDocRef = doc(db, `artifacts/${currentAppId}/users/${userId}/workouts`, 'userWorkouts');

      const unsubscribe = onSnapshot(userWorkoutsDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = JSON.parse(docSnap.data().data);
          setWorkoutData(data);
          console.log("Workout data loaded from Firestore:", data);
        } else {
          console.log("No workout data found in Firestore for this user.");
          setWorkoutData({});
        }
        setIsLoading(false);
      }, (error) => {
        console.error("Error fetching workout data:", error);
        setIsLoading(false);
      });

      return () => unsubscribe();
    } else if (isAuthReady && !firebaseApp) {
      // If auth is ready but Firebase app wasn't initialized (e.g., no config), stop loading
      setIsLoading(false);
    }
  }, [db, userId, isAuthReady, firebaseApp]);

  // Save workout data to Firestore whenever it changes (with debounce)
  useEffect(() => {
    // Only save if db && userId && isAuthReady && !isLoading && firebaseApp are all true
    if (db && userId && isAuthReady && !isLoading && firebaseApp) {
      const handler = setTimeout(() => {
        const currentAppId = (typeof window !== 'undefined' && typeof window.__app_id !== 'undefined') ? window.__app_id : 'default-local-app-id';
        const userWorkoutsDocRef = doc(db, `artifacts/${currentAppId}/users/${userId}/workouts`, 'userWorkouts');
        setDoc(userWorkoutsDocRef, { data: JSON.stringify(workoutData) }, { merge: true })
          .then(() => console.log("Workout data saved to Firestore."))
          .catch(error => console.error("Error saving workout data:", error));
      }, 500);

      return () => clearTimeout(handler);
    }
  }, [workoutData, db, userId, isAuthReady, isLoading, firebaseApp]);

  // Function to update exercise data for the selected date
  const updateExerciseData = useCallback((exerciseIndex, setIndex, field, value) => {
    const dateKey = formatDate(selectedDate);
    setWorkoutData(prev => {
      const newDayData = { ...prev[dateKey] };
      const currentExerciseData = newDayData[exerciseIndex] || {
        completed: Array(currentWorkout.exercises[exerciseIndex].sets).fill(false),
        weight: Array(currentWorkout.exercises[exerciseIndex].sets).fill(''),
        reps: Array(currentWorkout.exercises[exerciseIndex].sets).fill(currentWorkout.exercises[exerciseIndex].reps)
      };

      const newFieldArray = [...currentExerciseData[field]];
      newFieldArray[setIndex] = value;

      newDayData[exerciseIndex] = {
        ...currentExerciseData,
        [field]: newFieldArray
      };

      return {
        ...prev,
        [dateKey]: newDayData
      };
    });
  }, [selectedDate, currentWorkout]); // Recreate if selectedDate or currentWorkout changes

  // Function to toggle set completion for the selected date
  const toggleSetComplete = useCallback((exerciseIndex, setIndex) => {
    const dateKey = formatDate(selectedDate);
    const currentValue = workoutData[dateKey]?.[exerciseIndex]?.completed?.[setIndex] || false;
    updateExerciseData(exerciseIndex, setIndex, 'completed', !currentValue);
  }, [selectedDate, workoutData, updateExerciseData]);

  // Function to adjust reps for the selected date
  const adjustReps = useCallback((exerciseIndex, setIndex, increment) => {
    const dateKey = formatDate(selectedDate);
    const currentReps = workoutData[dateKey]?.[exerciseIndex]?.reps?.[setIndex] ||
                        currentWorkout.exercises[exerciseIndex].reps; // Fallback to plan reps
    const newReps = Math.max(0, currentReps + increment);
    updateExerciseData(exerciseIndex, setIndex, 'reps', newReps);
  }, [selectedDate, workoutData, currentWorkout, updateExerciseData]);


  // Placeholder for React-Calendar component
  // In a real environment, you would import and use a library like 'react-calendar'
  // Example: <Calendar onChange={setSelectedDate} value={selectedDate} tileContent={renderTileContent} />
  const renderCalendar = () => {
    // This is a simplified representation. A real calendar library would render a full calendar.
    // We'll just show the selected date and allow changing it for demonstration.
    const today = new Date();
    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0=Sun, 1=Mon

    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth(); // 0-11
    const numDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);

    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];

    const calendarDays = [];
    // Fill leading empty days
    for (let i = 0; i < startDay; i++) {
      calendarDays.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Fill days of the month
    for (let i = 1; i <= numDays; i++) {
      const dayDate = new Date(year, month, i);
      const dayKey = formatDate(dayDate);
      const hasWorkout = workoutData[dayKey] && Object.keys(workoutData[dayKey]).length > 0 &&
                         Object.values(workoutData[dayKey]).some(ex => ex.completed.some(c => c)); // Check if any set is completed
      const isSelected = formatDate(dayDate) === formatDate(selectedDate);
      const isToday = formatDate(dayDate) === formatDate(today);

      calendarDays.push(
        <button
          key={dayKey}
          onClick={() => setSelectedDate(dayDate)}
          className={`p-2 rounded-full text-center font-medium transition-colors relative
            ${isSelected ? 'bg-purple-600 text-white shadow-md' :
              isToday ? 'bg-purple-100 text-purple-700 font-bold' :
              'text-gray-700 hover:bg-gray-100'}
            ${hasWorkout ? 'border-2 border-green-500' : ''}
          `}
        >
          {i}
          {hasWorkout && (
            <span className="absolute bottom-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>
          )}
        </button>
      );
    }

    const handleMonthChange = (offset) => {
      const newDate = new Date(selectedDate);
      newDate.setMonth(newDate.getMonth() + offset);
      setSelectedDate(newDate);
    };

    return (
      <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-100">
            <Minus className="w-5 h-5 text-gray-600" />
          </button>
          <h3 className="text-xl font-semibold text-gray-800">
            {monthNames[month]} {year}
          </h3>
          <button onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100">
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-sm font-medium text-gray-500 mb-2">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calendarDays}
        </div>
        <p className="text-xs text-center text-gray-500 mt-4">
          <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-1"></span> Days with recorded workouts
        </p>
      </div>
    );
  };


  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center text-gray-600">
          <svg className="animate-spin h-10 w-10 text-purple-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p>Loading your gym data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Donna's Gym</h1>
              <p className="text-sm text-gray-600">Weekly Training Plan</p>
            </div>
          </div>

          {/* User ID Display */}
          {isAuthReady && userId && (
            <p className="text-xs text-gray-500 mb-4 break-all">
              User ID: <span className="font-mono bg-gray-100 px-2 py-1 rounded-md">{userId}</span>
            </p>
          )}
        </div>
      </div>

      {/* Workout Content */}
      <div className="px-4 py-6">
        {/* Calendar Component */}
        {renderCalendar()}

        {/* Workout Header */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div className="flex items-center gap-3 mb-3">
            <Calendar className="w-6 h-6 text-purple-500" />
            <h2 className="text-xl font-bold text-gray-800">
              {currentWorkout?.title} for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
          </div>
          <p className="text-gray-600 mb-2">{currentWorkout?.subtitle}</p>
          <div className="flex items-center gap-2 text-sm text-purple-600">
            <TrendingUp className="w-4 h-4" />
            <span>{currentWorkout?.duration}</span>
          </div>
        </div>

        {/* Exercises */}
        <div className="space-y-4">
          {currentWorkout?.exercises.length > 0 ? (
            currentWorkout.exercises.map((exercise, exerciseIndex) => {
              const dateKey = formatDate(selectedDate);
              // Get current data for this exercise and date, or initialize if not present
              const exerciseCurrentData = workoutData[dateKey]?.[exerciseIndex] || {
                completed: Array(exercise.sets).fill(false),
                weight: Array(exercise.sets).fill(''),
                reps: Array(exercise.sets).fill(exercise.reps)
              };

              return (
                <div key={exerciseIndex} className="bg-white rounded-2xl p-5 shadow-lg">
                  {/* Exercise Header with Image and Video Link */}
                  <div className="flex gap-4 mb-4">
                    {/* Exercise Photo */}
                    <div className="flex-shrink-0">
                      <img
                        src={exerciseMedia[exercise.name]?.image} // Using the original HubSpot image
                        alt={exercise.name}
                        className="w-20 h-20 rounded-xl object-cover border-2 border-gray-200"
                        crossOrigin="anonymous"
                        onLoad={(e) => {
                          if (e.target.nextElementSibling) {
                            e.target.nextElementSibling.style.display = 'none';
                          }
                        }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          if (e.target.nextElementSibling) {
                            e.target.nextElementSibling.style.display = 'flex';
                          }
                        }}
                        style={{ display: 'block' }}
                      />
                      {/* Fallback emoji icon (shown only if image fails) */}
                      <div
                        className="w-20 h-20 rounded-xl border-2 border-gray-200 bg-gradient-to-br from-purple-100 to-pink-100 flex items-center justify-center"
                        style={{ display: 'none' }}
                      >
                        <div className="text-center">
                          <div className="text-2xl mb-1">
                            {exercise.name.includes('Leg') ? '🦵' :
                             exercise.name.includes('Glute') || exercise.name.includes('Bridge') ? '🍑' :
                             exercise.name.includes('Hip') ? '🦴' :
                             exercise.name.includes('Step') || exercise.name.includes('Lunge') ? '👟' :
                             exercise.name.includes('Ab') ? '💪' :
                             exercise.name.includes('Plank') ? '🧘‍♀️' :
                             exercise.name.includes('Bulgarian') ? '🏋️‍♀️' :
                             exercise.name.includes('Cable') ? '🔗' : '💪'}
                          </div>
                          <div className="text-xs font-medium text-gray-600 leading-tight">
                            {exercise.name.split(' ')[0]}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Exercise Info */}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800">{exercise.name}</h3>
                      {exercise.note && (
                        <p className="text-sm text-gray-500">({exercise.note})</p>
                      )}
                      <p className="text-sm text-purple-600 font-medium mb-2">
                        {exercise.sets} sets × {exercise.reps} {exercise.type === 'time' ? 'seconds' : 'reps'}
                      </p>
                      <a
                        href={getYoutubeVideoUrl(exerciseMedia[exercise.name]?.videoId)} // Still linking to YouTube video
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-red-600 text-white px-3 py-1 rounded-full hover:bg-red-700 transition-colors"
                      >
                        <Play className="w-3 h-3" fill="white" />
                        Watch Demo
                      </a>
                    </div>
                  </div>

                  {/* Sets */}
                  <div className="space-y-3">
                    {Array.from({ length: exercise.sets }, (_, setIndex) => (
                      <div key={setIndex} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-medium text-gray-700">Set {setIndex + 1}</span>
                          <button
                            onClick={() => toggleSetComplete(exerciseIndex, setIndex)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                              exerciseCurrentData.completed?.[setIndex]
                                ? 'bg-green-500 text-white shadow-lg'
                                : 'bg-white border-2 border-gray-300 hover:border-green-400'
                            }`}
                          >
                            {exerciseCurrentData.completed?.[setIndex] && (
                              <Check className="w-5 h-5" />
                            )}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          {/* Weight input */}
                          {exercise.type === 'weight' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">
                                Weight (lbs/kg)
                              </label>
                              <input
                                type="number"
                                value={exerciseCurrentData.weight?.[setIndex] || ''}
                                onChange={(e) => updateExerciseData(exerciseIndex, setIndex, 'weight', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                placeholder="0"
                              />
                            </div>
                          )}

                          {/* Reps counter */}
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {exercise.type === 'time' ? 'Seconds' : 'Reps'}
                            </label>
                            <div className="flex items-center bg-white border border-gray-300 rounded-lg">
                              <button
                                onClick={() => adjustReps(exerciseIndex, setIndex, -1)}
                                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-l-lg"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="flex-1 text-center py-2 font-medium">
                                {exerciseCurrentData.reps?.[setIndex] || exercise.reps}
                              </span>
                              <button
                                onClick={() => adjustReps(exerciseIndex, setIndex, 1)}
                                className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-r-lg"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-lg text-center text-gray-600">
              <p className="text-lg font-semibold mb-2">No workout planned for this day.</p>
              <p>Select another day or add exercises to your plan!</p>
            </div>
          )}
        </div>

        {/* Completion Message */}
        <div className="mt-8 text-center">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl p-6 shadow-lg">
            <h3 className="text-lg font-bold mb-2">You've got this! 💪</h3>
            <p className="text-purple-100">Track your progress and celebrate every completed set.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GymTracker;
