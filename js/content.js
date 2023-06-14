// Pass state between browser action & injected script
const inFlightRequests = new Map();
const CLASS_NAMES = {
  MEET_SIDEBAR: 'R3Gmyc qwU8Me',
  MEET_SIDEBAR_VISIBLE: 'R3Gmyc qwU8Me qdulke',
  GMQM_FADEOUT: '__gmqm-fadeOut',
};

const allowedSource = 'toaster_quiz_master_content';

let registrationPolling = null;
let offlinePolling = null;
let settingsOverlay = null;
let settingsScript = null;
let meetingId = null;
let currentUserDetails = null;
let $sidebar = null;
let isFirstRun = false;
let isUIReady = false;
let isScriptsReady = false;
let port = null;
let isLeavingGame = false;
let searchForUserDetailsAttempts = 0;

const injectScript = (file_path, tag = 'html', type = 'script', text = '', id = '') => {

  var node = document.getElementsByTagName(tag)[0];
  var tag_type = type == type ? type : 'script';
  var script = document.createElement(tag_type);
  script.setAttribute('data-version', browser.runtime.getManifest().version);

  if (type == 'script') {
    script.setAttribute('type', 'text/javascript');
  } else if (type == 'module') {
    script.setAttribute('type', 'module');
  } else if (type == 'audio') {
    script.setAttribute('id', id);
    script.setAttribute('src', file_path);
  } else {
    script.setAttribute('rel', 'stylesheet');
    script.setAttribute('media', 'screen');

  }
  if (text == '') {
    script.setAttribute(tag_type == 'script' ? 'src' : 'href', file_path);
  } else {
    script.innerHTML = text;
  }

  node.appendChild(script);
};

const searchForUserDetails = () => {
  if (currentUserDetails !== null) {
    return currentUserDetails;
  }

  const scripts = document.querySelectorAll('script');

  let userDetails = null;
  searchForUserDetailsAttempts++;

  for (let i = 0; i < scripts.length; i++) {
    const content = scripts[i].innerHTML;

    if (content.startsWith('AF_initDataCallback') && (content.indexOf('lh3.googleusercontent.com') > -1 || content.indexOf('lh6.googleusercontent.com') > -1)) {
      userDetails = {};
      const regex = /\[(.*?)\]/;
      let temp = content.match(regex)[1].split(',');
      userDetails.name = temp[6].replace(/"/g, '');

      let imageUrl = temp[5].replace(/"/g, '');
      if (!imageUrl.endsWith('photo.jpg')) {
        imageUrl = imageUrl.split('\\u003d')[0]; // remove fife params
      }

      const temp2 = imageUrl.split('/');
      let id = temp2[temp2.length - 1];
      if (imageUrl.endsWith('photo.jpg')) {
        id = temp2[temp2.length - 3];
      }

      userDetails.image = imageUrl;
      userDetails.id = id;
      // Email data is not really needed
      //userDetails.email = temp[4].replace(/"/g, '');

      break;
    }
  }

  if (searchForUserDetailsAttempts > 2 && userDetails === null) {
    // Most likely a guest user
    const guestAvatar = document.querySelector('[data-fps-request-screencast-cap] img');
  
    //s192-c-mo
    // https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/ked95zySGpoPq1TOEJdVg_tCIM09_n75QCKYCEAEiGQoBQhD___________8BGLeA9fr______wE/s72-p-k-no-mo/avatar.png
    if (guestAvatar.src) {
      let imageUrl = guestAvatar.src.replace('\/s72-p-k-no-mo\/', '/s192-c-mo/');
      userDetails = {};
      userDetails.name = 'Guest';
      userDetails.image = imageUrl;
      userDetails.id = 'guest-' + (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15) + '-' + performance.now()).replace('.','-');
      //userDetails.email = '';
    }    

    
  }

  console.log(userDetails)

  return userDetails;
};

const injectQuizMasterScriptsIntoToolbar = async () => {
  if (!isScriptsReady) {
    // inject UI style
    settingsScript = await import(browser.runtime.getURL('js/settings-overlay.js'));

    injectScript(
      browser.runtime.getURL('css/animations.css'), 'html', 'link'
    );

    injectScript(
      browser.runtime.getURL('css/quizmaster.css'), 'html', 'link'
    );

    injectScript(
      browser.runtime.getURL('audio/alert_error-01.ogg'),
      'body',
      'audio',
      null,
      settingsScript.QUIZ_MASTER_WRONG_AUDIO_ID
    );

    injectScript(
      browser.runtime.getURL('audio/hero_decorative-celebration-02.ogg'),
      'body',
      'audio',
      null,
      settingsScript.QUIZ_MASTER_CORRECT_AUDIO_ID
    );
  }

  return true;
}

const injectQuizMasterUIIntoToolbar = async () => {
  if (isUIReady) {
    return true;
  }

  // inject overlay settings
  if (!settingsOverlay) {
    await settingsScript.injectSettingsOverlayUI();
    settingsOverlay = settingsScript.getSettingsOverlay();
  }

  // Bottom right Buttons
  let ownVideoPreview = document.querySelector('[data-is-menu-hoisted]');
  let buttons = ownVideoPreview && ownVideoPreview.firstElementChild;
  
  // Check for old layout
  if (!ownVideoPreview) {
    ownVideoPreview = document.querySelector('[data-fps-request-screencast-cap]');
  }

  // Check for old layout
  if (!buttons.children[1]) {
    buttons = ownVideoPreview && ownVideoPreview.parentElement.parentElement.parentElement;
  }

  // Check for old new layout
  if (!buttons.children[1]) {
    buttons = ownVideoPreview && ownVideoPreview.parentElement.parentElement.parentElement.parentElement;
  }

  if (buttons && !buttons.dataset.quizMasterInit && buttons.children[1]) {
    buttons.dataset.quizMasterInit = true;

    // Prevent options getting cut off by pin/mute overlay or speaker overlay
    buttons.parentElement.parentElement.parentElement.style.zIndex = 10;

    // Find the button container element and copy the divider
    buttons.prepend(buttons.children[1].cloneNode());
    
    // Add our button to to enable/disable quiz mode
    toggleButton = document.createElement('div');
    toggleButton.classList = buttons.children[1].classList;
    toggleButton.classList.add('__gmqm-button');
    toggleButton.setAttribute('aria-label', 'Play quiz master on Google Meet');
    toggleButton.setAttribute('aria-disabled', 'false');
    toggleButton.setAttribute('role', 'button');
    toggleButton.onclick = async () => {
      if (settingsScript) {
        if (!isLeavingGame & port !== null) {
          settingsScript.hideSettingsUI(); 
          await leaveGame();
        } else if (!isLeavingGame & port === null) {
          isUIReady = true; // quick fix for race condition
          await connectToGame();
          settingsScript.showAppShell();
          settingsScript.showSettingsUI();
        }
      }
    }
    buttons.prepend(toggleButton);

    toggleButton.innerHTML = `<svg viewBox="0 0 24 24"><path d="M0 0h24v24H0zm21.02 19c0 1.1-.9 2-2 2h-14c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v14z" fill="none"/><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/></svg>`;

    // listen to transitions of sidebar (people and chat) to show or hide our UI
    $sidebar = document.querySelector(`.${CLASS_NAMES.MEET_SIDEBAR}`);

    if ($sidebar !== null && !$sidebar.dataset.quizMasterInit) {
      $sidebar.dataset.quizMasterInit = true;
      // listen to transitionend to show overlay only after the sidebar is gone
      $sidebar.addEventListener('transitionend', sidebarTransitionEnd);
      // listen to transitionstart to hide the overlay the moment the sidebar moves
      $sidebar.addEventListener('transitionstart', sidebarTransitionStart);
    }

    return true;

  } else {

    return false;
  }
};

const checkOnlineStatus = async () => {
  const participantVideo = document.querySelector('[data-allocation-index]');
  const container = participantVideo && participantVideo.parentElement;

  const meetingIdElem = document.querySelector('[data-unresolved-meeting-id]');
  const tempMeetingId = meetingIdElem ? meetingIdElem.dataset.unresolvedMeetingId : null;

  if (container && tempMeetingId && tempMeetingId === meetingId) {
    console.log('user is still logged in');
    return;
  }

  if (meetingId === null) {
    console.log('meeting id is null');
    return;
  }

  // remove overlay settings
  if (settingsScript) {
    settingsScript.hideSettingsUI();
  }


  // user is no longer in the meet session
  try {
    if (port !== null) {
      await port.disconnect();
    }
  } catch (e) {
    console.error(e);
  }
};

const registerUser = async () => {


  const participantVideo = document.querySelector('[data-allocation-index]');
  const container = participantVideo && participantVideo.parentElement;

  const meetingIdElem = document.querySelector('[data-unresolved-meeting-id]');
  meetingId = meetingIdElem ? meetingIdElem.dataset.unresolvedMeetingId : null;

  if (!container || !meetingId) {
    console.log('no active meet session yet');
    return;
  }

  currentUserDetails = searchForUserDetails();

  // inject UI
  if (currentUserDetails) {
    isScriptsReady = await injectQuizMasterScriptsIntoToolbar();
    isUIReady = await injectQuizMasterUIIntoToolbar();
  }


  if (meetingId && currentUserDetails && !isFirstRun && isUIReady && isScriptsReady) {
    isFirstRun = true;

    // remove polling
    if (registrationPolling) {
      clearInterval(registrationPolling);
      registrationPolling = null;
    }

  }

  return;

}

const connectToGame = async () => {
  console.log("connectToGame", meetingId , currentUserDetails , isFirstRun , isUIReady , isScriptsReady)

  if (meetingId && currentUserDetails && isUIReady && isScriptsReady && !isFirstRun) {
    isFirstRun = true;
    if (registrationPolling) {
      clearInterval(registrationPolling);
      registrationPolling = null;
    }
  }

  if (meetingId && currentUserDetails && isFirstRun && isUIReady && isScriptsReady) {
    
    // Let background know we have a connection
    port = await browser.runtime.connect({
      name: allowedSource
    });

    await portMessageListener();

    try {
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'register',
        meeting_id: meetingId,
        participant: currentUserDetails
      });
    } catch (e) {
      console.error(e);
    }

    // begin offline polling
    if (offlinePolling) {
      clearInterval(offlinePolling);
      offlinePolling = null;
    }

    offlinePolling = setInterval(checkOnlineStatus, 1000);

  }

  return;
};

const leaveGame = async () => {
  
  if (isLeavingGame) {
    return;
  }
  isLeavingGame = true;
  try {
    await port.disconnect();
    await port.onDisconnect.removeListener();
    await port.onMessage.removeListener();
    await wait(); // :(
    port = null;
    isLeavingGame = false;
  } catch (e) {
    isLeavingGame = false;
    console.error(e);
  }

  return;
}

const wait = async () => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  return;
}


const portMessageListener = async () => {
  
  port.onDisconnect.addListener(async (p) => {
    if (p.error) {
      console.log(`Disconnected due to an error: ${p.error.message}`);
    }
  });

  port.onMessage.addListener(async (request) => {
    console.log("Content:", request);

    const actionType = request.type;

    console.log('message for:', meetingId, actionType);

    switch (actionType) {
      // case 'poll_user_signin':
      //   console.log('poll user sign in');
      //   if (!registrationPolling) {
      //     // run polling and try to register user
      //     registrationPolling = setInterval(registerUser, 5000);
      //   }
      //   break;
      case 'db_sync':
        if (meetingId === request.meetingId) {
          // do something, user is registere
          await wait(); // o dear...
          settingsScript.hideAppShell();
        }
        break;
      case 'db_quiz_wrong_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.toggleWrongState(true);
        }
        break;
      case 'db_quiz_wrong_reset_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.toggleWrongState(false);
        }
        break;
      case 'db_quiz_correct_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.toggleCorrectState(true);
        }
        break;
      case 'db_quiz_correct_reset_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.toggleCorrectState(false);
        }
        break;
      case 'db_quiz_ask_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.showQuestion(request.questionId, false);
          settingsScript.toggleAskState(true);
        }
        break;
      case 'db_quiz_ask_reset_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.toggleAskState(false);
          settingsScript.removeQuestion(false);
        }
        break;
      case 'db_quiz_question_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.showQuestion(request.questionId, true);
        }
        break;
      case 'db_quiz_question_reset_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.removeQuestion(true);
        }
        break;
      case 'db_quiz_answer_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.addFastestAnswer(request.userID);
        }
        break;
      case 'db_quiz_answer_reset_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.removeFastestAnswer();
        }
        break;
      case 'db_quiz_quiz_master_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.setQuizMaster(request.quizMasterID, request.userDetails);
        }
        break;
      case 'db_quiz_quiz_master_reset_sync':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.unsetQuizMaster();
        }
        break;
      case 'db_quiz_user_removed':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.removeUser(request.userDetails);
        }
        break;
      case 'db_quiz_user_added':
        if (meetingId === request.meetingId && settingsScript) {
          settingsScript.addUser(request.userDetails);
        }
        break;
      case 'db_quiz_points_added':
        if (meetingId === request.meetingId && settingsScript) {
          console.log("db_quiz_points_added");
          settingsScript.updatePoints(request.userPoints);
        }
        break;
      case 'db_quiz_points_changed':
        if (meetingId === request.meetingId && settingsScript) {
          console.log("db_quiz_points_changed");
          settingsScript.updatePoints(request.userPoints);
        }
        break;
      case 'db_quiz_points_removed':
        if (meetingId === request.meetingId && settingsScript) {
          console.log("db_quiz_points_changed");
          settingsScript.removePoints(request.userPoints);
        }
        break;
    }
  });
}

const sidebarTransitionEnd = (e) => {
  // bail if our overlay is absent or the transition target is not the sidebar
  if (settingsOverlay == null || $sidebar.isSameNode(e.target) == false) {
    return;
  }

  if (e.target.classList.contains(CLASS_NAMES.MEET_SIDEBAR_VISIBLE) == false) {
    settingsOverlay.classList.remove(CLASS_NAMES.GMQM_FADEOUT);
  }
};

const sidebarTransitionStart = (e) => {
  // bail if our overlay is absent or the transition target is not the sidebar
  if (settingsOverlay == null || $sidebar.isSameNode(e.target) == false) {
    return;
  }

  if (e.target.classList.contains(CLASS_NAMES.MEET_SIDEBAR_VISIBLE) == true) {
    settingsOverlay.classList.add(CLASS_NAMES.GMQM_FADEOUT);
  }
};


if (!registrationPolling) {
  // run polling and try to register user
  registrationPolling = setInterval(registerUser, 5000);
}


