let firebaseApp = null;
let dbListener = {};
let ports = {};
const allowedSource = 'toaster_quiz_master_content';

const initFirebase = async () => {
  if (firebaseApp) {
    console.log('firebase init not needed');
    return;
  }

  console.log('initializing firebase app');

  // initialise firebase
  firebaseApp = firebase.initializeApp({
    apiKey: 'AIzaSyBmgWXtIzrZOiqUX2AAgOYD3BrG6Ld0Q4I',
    authDomain: 'toast-goog-meet-quiz.firebaseapp.com',
    databaseURL: 'https://toast-goog-meet-quiz.firebaseio.com',
    projectId: 'toast-goog-meet-quiz',
    storageBucket: 'toast-goog-meet-quiz.appspot.com',
    messagingSenderId: '1009961630969',
    appId: '1:1009961630969:web:04d790121d7e0f5f8ff628',
    measurementId: 'G-JX53WFFX78'
  });
};

const destroyFirebase = async () => {
  if (!firebaseApp) {
    console.log('no firebase instance need to be destroyed');
    return;
  }

  await firebaseApp.delete();
  firebaseApp = null;
  console.log('deleted firebase app');
};



// Using ports to handle connections from multiple tabs, user accounts etc.
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port
browser.runtime.onConnect.addListener(async (port) => {
  console.log("Background:", port);

  // Only allow for connections from allowedSources
  if (port.name !== allowedSource) {
    return false;
  }

  // Add port to tracking list
  ports[port.sender.tab.id] = port;

  // Listen to all incoming approved messages
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port
  port.onMessage.addListener(async (request) => {
    // We assume these props are always sent with the message
    const actionType = request.type;
    const meetingId = request.meeting_id;
    const participant = request.participant;

    // Check if Firebase App is running if not this is the first port calling it
    if (!firebaseApp) {
      await initFirebase();
    }

    // get database
    const _db = firebaseApp.database();

    console.log(`onMessage: actionType: ${actionType}`);

    switch (actionType) {
      case 'answer_quiz':
        _db.ref(`${meetingId}/answer`).transaction((answer) => {
          if (answer === null) {
            return participant.id;
          } else {
            return answer; // too slow.
          }
        }, null, false);
        break;
      case 'question_quiz':
        await _db.ref(`${meetingId}/questions/question`).set(request.question_id);
        break;
      case 'custom_question_quiz':
        await _db.ref(`${meetingId}/questions/custom_question`).set(request.question_text);
        break;
      case 'ask_quiz':
        _db.ref(`${meetingId}/questions`).once('value')
        .then((snapshot) => {
          const questionText = (snapshot.val() && snapshot.val().custom_question) || '';
          const questionId = (snapshot.val() && snapshot.val().question) || null;
          if (questionText.length) { 
            _db.ref(`${meetingId}/ask`).set(questionText);
          } else if (questionId !== null) {
            _db.ref(`${meetingId}/ask`).set(questionId);
          } else {
            _db.ref(`${meetingId}/ask`).set(true);
          }
        });
        break;
      case 'reset_quiz':
        await _db.ref(`${meetingId}/ask`).set(null);
        await _db.ref(`${meetingId}/answer`).set(null);
        await _db.ref(`${meetingId}/wrong`).set(null);
        await _db.ref(`${meetingId}/correct`).set(null);
        break;
      case 'clear_all_quiz_points':
        await _db.ref(`${meetingId}/points`).set(null);
        break;
      case 'wrong_quiz_answer':
        await _db.ref(`${meetingId}/wrong`).set(true);
        break;
      case 'reset_wrong_quiz_answer':
        await _db.ref(`${meetingId}/wrong`).set(false);
        break;
      case 'correct_quiz_answer':
        await _db.ref(`${meetingId}/correct`).set(true);
        _db.ref(`${meetingId}/answer`).once('value')
        .then((snapshot) => {
          if (snapshot) {
            const answerUserId = snapshot.val();
            if (answerUserId === null) {
              return;
            }
            _db.ref(`${meetingId}/points/${answerUserId}`).transaction((points) => {
              if (points) {
                points++;
              } else {
                points = 1;
              }
              return points;
            }, (error, committed, snapshot) => {
              // Point added
              if (committed) {
                console.log("onMessage: correct_quiz_answer: 1 point added");
              }
            });
          }
        });
        break;
      case 'reset_correct_quiz_answer':
        await _db.ref(`${meetingId}/correct`).set(false);
        break;
      case 'set_quiz_master':
        _db.ref(`${meetingId}/quiz_master`).transaction((userId) => {
          if (userId === null) {
            return participant.id;
          } else {
            return userId;
          }
        });
        break;
      case 'unset_quiz_master':
        await _db.ref(`${meetingId}/quiz_master`).set(null);
        // reset UI and question state
        // this applies to scenarios where a question is asked but the quiz master drops off/exits
        await _db.ref(`${meetingId}/ask`).set(null);
        await _db.ref(`${meetingId}/answer`).set(null);
        await _db.ref(`${meetingId}/questions/question`).set(null);
        await _db.ref(`${meetingId}/questions/custom_question`).set(null);
        await _db.ref(`${meetingId}/wrong`).set(null);
        await _db.ref(`${meetingId}/correct`).set(null);
        await _db.ref(`${meetingId}/points`).set(null);
        break;
      case 'unregister':
        port.disconnect();
        break;
      case 'register':
        // Attach meeting ID to port, this allow us to use it on a disconnect event
        port.meeting_id = meetingId;
        port.user_id = participant.id;

        const meetRef = _db.ref(`${meetingId}/users/${participant.id}`);

        await meetRef.set(participant);

        // Create dbListners for tab id; If already set up skip
        if (!dbListener[port.sender.tab.id]) {
          dbListener[port.sender.tab.id] = {};

          // begin listening to quiz collection
          dbListener[port.sender.tab.id]['users_added'] = {
            field: 'users',
            event: 'child_added',
            listener: _db.ref(`${meetingId}/users`).on('child_added',  (childSnapshot) => {
              console.log('quiz: ', meetingId, 'users_added listener');
              try {
                port.postMessage({
                  type: 'db_quiz_user_added',
                  meetingId: meetingId,
                  userDetails: childSnapshot.val()
                });
              } catch(e) {
                // old port
              }
            })
          };

          dbListener[port.sender.tab.id]['users_removed'] = {
            field: 'users',
            event: 'child_removed',
            listener: _db.ref(`${meetingId}/users`).on('child_removed', (childSnapshot) => {
              console.log('quiz: ', meetingId, 'users_removed listener');
              try {
                port.postMessage({
                  type: 'db_quiz_user_removed',
                  meetingId: meetingId,
                  userDetails: childSnapshot.val()
                });
              } catch(e) {
                // old port
              }
            })
          };

          dbListener[port.sender.tab.id]['correct'] = {
            field: 'correct',
            event: 'value',
            listener: _db.ref(`${meetingId}/correct`).on('value', (dataSnapshot) => {
              const correctVal = dataSnapshot.val();
              console.log('quiz: ', meetingId, 'correct listener');
              if (correctVal === true) {
                try {
                  port.postMessage({
                    type: 'db_quiz_correct_sync',
                    meetingId: meetingId
                  });
                } catch(e) {
                  // old port
                }
              } else {
                try {
                  port.postMessage({
                    type: 'db_quiz_correct_reset_sync',
                    meetingId: meetingId
                  });
                } catch(e) {
                  // old port
                }
              }
            })
          };

          dbListener[port.sender.tab.id]['wrong'] = {
            field: 'wrong',
            event: 'value',
            listener: _db.ref(`${meetingId}/wrong`).on('value', (dataSnapshot) => {
              const wrongVal = dataSnapshot.val();
              console.log('quiz: ', meetingId, 'wrong listener');
              if (wrongVal === true) {
                try {
                  port.postMessage({
                    type: 'db_quiz_wrong_sync',
                    meetingId: meetingId
                  });
                } catch(e) {
                  // old port
                }
              } else {
                try {
                  port.postMessage({
                    type: 'db_quiz_wrong_reset_sync',
                    meetingId: meetingId
                  });
                } catch(e) {
                  // old port
                }
              }
            })
          };

          dbListener[port.sender.tab.id]['ask'] = {
            field: 'ask',
            event: 'value',
            listener: _db.ref(`${meetingId}/ask`).on('value', (dataSnapshot) => {
              const askVal = dataSnapshot.val();
              console.log('quiz: ', meetingId, 'ask listener');
              if (askVal !== null) {
                try {
                  port.postMessage({
                    type: 'db_quiz_ask_sync',
                    meetingId: meetingId,
                    questionId: askVal
                  });
                } catch(e) {
                  // old port
                }
              } else {
                try {
                  port.postMessage({
                    type: 'db_quiz_ask_reset_sync',
                    meetingId: meetingId
                  });
                } catch(e) {
                  // old port
                }
              }
            })
          };

          dbListener[port.sender.tab.id]['question'] = {
            field: 'question',
            event: 'value',
            listener: _db.ref(`${meetingId}/questions/question`).on('value', (dataSnapshot) => {
              const questionVal = dataSnapshot.val();
              console.log('quiz: ', meetingId, 'question listener');
              if (questionVal !== null) {
                try {
                  port.postMessage({
                    type: 'db_quiz_question_sync',
                    meetingId: meetingId,
                    questionId: questionVal
                  });
                } catch(e) {
                  // old port
                }
              } else {
                try {
                  port.postMessage({
                    type: 'db_quiz_question_reset_sync',
                    meetingId: meetingId
                  });
                } catch(e) {
                  // old port
                }
              }
            })
          };

          dbListener[port.sender.tab.id]['answer'] = {
            field: 'answer',
            event: 'value',
            listener: _db.ref(`${meetingId}/answer`).on('value', (dataSnapshot) => {
              const answerVal = dataSnapshot.val();
              console.log('quiz: ', meetingId, 'answer listener', answerVal);
              if (answerVal) {
                try{
                  port.postMessage({
                    type: 'db_quiz_answer_sync',
                    meetingId: meetingId,
                    userID: answerVal
                  });
                } catch(e) {
                  // old port
                }
              } else {
                try {
                  port.postMessage({
                    type: 'db_quiz_answer_reset_sync',
                    meetingId: meetingId
                  });
                } catch(e) {
                  // old port
                }
              }
            })
          };

          dbListener[port.sender.tab.id]['quiz_master'] = {
            field: 'quiz_master',
            event: 'value',
            listener: _db.ref(`${meetingId}/quiz_master`).on('value', (dataSnapshot) => {
              const quizMasterVal = dataSnapshot.val();
              console.log('quiz: ', meetingId, 'quiz_master listener');
              if (quizMasterVal) {
                try {
                  port.postMessage({
                    type: 'db_quiz_quiz_master_sync',
                    meetingId: meetingId,
                    quizMasterID: quizMasterVal,
                    userDetails: participant.id
                  });
                } catch(e) {
                  // old port
                }
              } else {
                try {
                  port.postMessage({
                    type: 'db_quiz_quiz_master_reset_sync',
                    meetingId: meetingId
                  });
                } catch(e) {
                  // old port
                }
              }
            })
          };

          dbListener[port.sender.tab.id]['points_added'] = {
            field: 'points',
            event: 'child_added',
            listener: _db.ref(`${meetingId}/points`).on('child_added',  (childSnapshot) => {
              console.log('quiz: ', meetingId, 'points_added listener');
              try {
                port.postMessage({
                  type: 'db_quiz_points_added',
                  meetingId: meetingId,
                  userPoints: {
                    id: childSnapshot.key,
                    points: childSnapshot.val()
                  }
                });
              } catch(e) {
                // old port
              }
            })
          };

          dbListener[port.sender.tab.id]['points_changed'] = {
            field: 'points',
            event: 'child_changed',
            listener: _db.ref(`${meetingId}/points`).on('child_changed',  (childSnapshot) => {
              console.log('quiz: ', meetingId, 'points_changed listener');
              try {
                port.postMessage({
                  type: 'db_quiz_points_changed',
                  meetingId: meetingId,
                  userPoints: {
                    id: childSnapshot.key,
                    points: childSnapshot.val()
                  }
                });
              } catch(e) {
                // old port
              }
            })
          };

          dbListener[port.sender.tab.id]['points_removed'] = {
            field: 'points',
            event: 'child_removed',
            listener: _db.ref(`${meetingId}/points`).on('child_removed',  (childSnapshot) => {
              console.log('quiz: ', meetingId, 'points_removed listener');
              try {
                port.postMessage({
                  type: 'db_quiz_points_removed',
                  meetingId: meetingId,
                  userPoints: {
                    id: childSnapshot.key,
                    points: childSnapshot.val()
                  }
                });
              } catch(e) {
                // old port
              }
            })
          };
        }

        try {
          port.postMessage({
            type: 'db_sync',
            meetingId: meetingId,
            message: 'you have joined the quiz master'
          });
        } catch(e) {
          // old port
        }
        break;
    }

    // This needs to be returned to resolve some browser differences
    // ref: TBA
    return Promise.resolve();
  });

  // Unregister the connection.
  // This will trigger if the user closes the tab, refreshes or the tab sends a Port.disconnect();
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/Port
  port.onDisconnect.addListener(async (p) => {
    console.log('onDisconnect:', p);

    // error is only sent if something goes wrong with the browser or extension
    // chorme needs to use browser.runtime.lastError
    if (p.error || browser.runtime.lastError) {
      console.log(`onDisconnect: Disconnected due to an error: ${browser.runtime.lastError}`);
    }

    if (firebaseApp) {

      const _db = firebaseApp.database();
      const meetRefDelete = _db.ref(`${p.meeting_id}/users/${p.user_id}`);
      const quizMasterRefDelete = _db.ref(`${p.meeting_id}/quiz_master`);
      const answerRefDelete = _db.ref(`${p.meeting_id}/answer`);
      const questionRefDelete = _db.ref(`${p.meeting_id}/questions/question`);
      const customQuestionRefDelete =  _db.ref(`${p.meeting_id}/questions/custom_question`);
      const askRefDelete = _db.ref(`${p.meeting_id}/ask`);
      const correctRefDelete = _db.ref(`${p.meeting_id}/correct`);
      const wrongRefDelete = _db.ref(`${p.meeting_id}/wrong`);
      const pointsRefDelete = _db.ref(`${p.meeting_id}/points`);

      // Build list of all ports using the same meeting id and user id;
      const listOfMeetngIds = Object.keys(ports).map((key) => ports[key]).filter((obj) => {
        return obj.meeting_id === p.meeting_id && obj.user_id === p.user_id;
      });

      console.log(`onDisconnect: listOfMeetngIds: ${listOfMeetngIds.length}`);

      // Remove all snapshot listeners and set other values to null
      // Delete snapshots listeners
      if (dbListener[p.sender.tab.id]) {
        console.log('onDisconnect: delete snapshots');

        await Promise.all(Object.keys(dbListener[p.sender.tab.id]).map((key) => {
          return new Promise(async (resolve, reject) => {
            const temp = dbListener[p.sender.tab.id][key];
            if (temp) {
              await _db.ref(`${p.meeting_id}/${temp.field}`).off(temp.event, temp.listener);
              console.log(`onDisconnect: delete listner: ${key}`)
              delete dbListener[p.sender.tab.id][key];
              resolve();
            }
            resolve();
          });
        }));
      }

      // only if no other port is using the meeting id with the same user id;
      if (listOfMeetngIds.length === 1) {
        // Set other firebase items to null

        // Set user
        await meetRefDelete.set(null);

        // Quiz Master reset
        await quizMasterRefDelete.once('value')
        .then((snapshot) => {
          if (snapshot) {
            const quizMasterUserId = snapshot.val();
            if (quizMasterUserId === p.user_id) {
              questionRefDelete.set(null);
              customQuestionRefDelete.set(null);
              askRefDelete.set(null);
              quizMasterRefDelete.set(null);
              correctRefDelete.set(null);
              wrongRefDelete.set(null);
              pointsRefDelete.set(null);
            }
          }
        });

        // Answer reset
        await answerRefDelete.once('value')
        .then((snapshot) => {
          if (snapshot) {
            const answerUserId = snapshot.val();
            if (answerUserId === p.user_id) {
              answerRefDelete.set(null);
              correctRefDelete.set(null);
              wrongRefDelete.set(null);
            }
          }
        });
      }
    }

    // Unregister port listeners
    p.onMessage.removeListener();
    p.onDisconnect.removeListener();

    // Remove port from port tracking list and dbListener list
    delete ports[p.sender.tab.id];
    delete dbListener[p.sender.tab.id];

    // Check if port tracking list object is empty if so destroy Firebase
    if (Object.keys(ports).length === 0) {
      await destroyFirebase();
    }

  });

  // Start polling pages
  port.postMessage({
    type: 'poll_user_signin',
    meetingId: null
  });

});

const CLIENT_ID = encodeURIComponent('688089180727-b2r58p0idgihdou17cg66h9bqr4cu2tl.apps.googleusercontent.com');
const RESPONSE_TYPE = encodeURIComponent('id_token');
const REDIRECT_URI = encodeURIComponent('https://ihgmcfkaepheifmencolnpchfdpadeij.chromiumapp.org')
const SCOPE = encodeURIComponent('openid profile');
const STATE = encodeURIComponent('meet' + Math.random().toString(36).substring(2, 15));
const PROMPT = encodeURIComponent('consent');

let user_signed_in = false;

function is_user_signed_in() {
    return user_signed_in;
}


function create_auth_endpoint() {
    let nonce = encodeURIComponent(Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15));

    let openId_endpoint_url =
        `https://accounts.google.com/o/oauth2/v2/auth
?client_id=${CLIENT_ID}
&response_type=${RESPONSE_TYPE}
&redirect_uri=${REDIRECT_URI}
&scope=${SCOPE}
&state=${STATE}
&nonce=${nonce}
&prompt=${PROMPT}`;

    return openId_endpoint_url;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'login') {
        if (user_signed_in) {
            console.log("User is already signed in.");
        } else {
            chrome.identity.launchWebAuthFlow({
                'url': create_auth_endpoint(),
                'interactive': true
            }, function (redirect_url) {
                if (chrome.runtime.lastError) {
                    // problem signing in
                } else {
                    let id_token = redirect_url.substring(redirect_url.indexOf('id_token=') + 9);
                    id_token = id_token.substring(0, id_token.indexOf('&'));
                    const user_info = KJUR.jws.JWS.readSafeJSONString(b64utoutf8(id_token.split(".")[1]));

                    if ((user_info.iss === 'https://accounts.google.com' || user_info.iss === 'accounts.google.com')
                        && user_info.aud === CLIENT_ID) {
                        console.log("User successfully signed in.");
                        user_signed_in = true;
                        user_name = user_info.name;
                        console.log(user_name);
                        chrome.browserAction.setPopup({ popup: './popup-signed-in.html' }, () => {
                            sendResponse('success');
                        });
                    } else {
                        // invalid credentials
                        console.log("Invalid credentials.");
                    }
                }
            });

            return true;
        }
    } else if (request.message === 'logout') {
        user_signed_in = false;
        chrome.browserAction.setPopup({ popup: './popup.html' }, () => {
            sendResponse('success');
        });

        return true;
    } else if (request.message === 'isUserSignedIn') {
        sendResponse(is_user_signed_in());
    }
});






