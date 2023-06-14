const SETTINGS_OVERLAY_ID = 'gmqm-settings-overlay';
const QUIZ_MASTER_WRONG_AUDIO_ID = 'gmqm-wrong-audio';
const QUIZ_MASTER_CORRECT_AUDIO_ID = 'gmqm-correct-audio';
const SETTINGS_UI_ID = {
  ASK: 'gmqmBtnAsk',
  ANSWER: 'gmqmBtnAnswer',
  RESET: 'gmqmBtnReset',
  CLEAR_POINTS: 'gmqmBtnClearPoints',
  WRONG: 'gmqmBtnWrong',
  CORRECT: 'gmqmBtnCorrect',
  QUIZ_MASTER: 'gmqmIsQuizMaster',
  USER_ITEM: 'gmqmUserListItem',
  USER_LIST: 'gmqmUserList',
  QUESTION_BOX: 'gmqmQuestionView',
  QUESTION_ITEM: 'gmqmQuestionItem',
  QUESTION_WRAPPER: 'gmqmQuestionWrapper',
  CUSTOM_QUESTION_BOX: 'gmqmCustomQuestionView',
  CUSTOM_QUESTION_ITEM: 'gmqmCustomQuestionItem',
  CUSTOM_QUESTION_WRAPPER: 'gmqmCustomQuestionWrapper',
  CONTAINER_WRAPPER: 'gmqmContainerWrapper'
};
const INVISIBLE_CLASS = '__gmqm-invisible';
const APP_SHELL_CLASS = '__gmqm-appshell';
const USERS_FASTEST_ANSWER_CLASS = '__gmqm-Fastest';
const USERS_POINTS_WRAPPER_CLASS = '__gmqm-peopleListItemPoints';
const USERS_POINTS_CLASS = '__gmqm-peopleListItemPointsText';
const USERS_QUIZ_MASTER_CLASS = '__gmqm-SelectedQuizMaster';

const USER_IS_QUIZ_MASTER_CLASS = '__gmqm-quizmaster';
const USER_IS_PARTICIPANT_CLASS = '__gmqm-participant';

let answerWrongTimeout = null;
let answerCorrectTimeout = null;

const getSettingsOverlay = () => {
  return document.getElementById(SETTINGS_OVERLAY_ID);
};

const showAppShell = () => {
  const temp = getSettingsOverlay();
  const wrapper = document.getElementById(SETTINGS_UI_ID.CONTAINER_WRAPPER);
  temp.classList.add(APP_SHELL_CLASS);
  wrapper.classList.add(INVISIBLE_CLASS);
}

const hideAppShell = () => {
  const temp = getSettingsOverlay();
  const wrapper = document.getElementById(SETTINGS_UI_ID.CONTAINER_WRAPPER);
  temp.classList.remove(APP_SHELL_CLASS);
  wrapper.classList.remove(INVISIBLE_CLASS);
}

const hideSettingsUI = () => {
  const temp = getSettingsOverlay();
  temp.classList.add('__gmqm-hidden');
};

const showSettingsUI = () => {
  const temp = getSettingsOverlay();
  temp.classList.remove('__gmqm-hidden');
};

const toggleSettingsUI = () => {
  const temp = getSettingsOverlay();
  temp.classList.toggle('__gmqm-hidden');
  return temp.classList.contains('__gmqm-hidden');
};

const getWrongAudio = () => {
  return document.getElementById(QUIZ_MASTER_WRONG_AUDIO_ID);
};

const getCorrectAudio = () => {
  return document.getElementById(QUIZ_MASTER_CORRECT_AUDIO_ID);
};

const addUser = (userDetails) => {
  if (!userDetails || !userDetails.id || !userDetails.name) {
    return;
  }

  const temp = getSettingsOverlay();

  const currentLi = temp.querySelector(`#${userDetails.id}`);
  if (currentLi) {
    return;
  }

  const template = temp.querySelector(`#${SETTINGS_UI_ID.USER_ITEM}`);

  const clone = template.content.cloneNode(true);

  const img = clone.querySelector('.__gmqm-peopleListItemProfile img');
  img.setAttribute('src', `${userDetails.image}${img.dataset.imgParam}`);

  const name = clone.querySelector('.__gmqm-peopleListItemLabel');
  name.innerText = userDetails.name;

  const li = document.createElement('li');
  li.id = userDetails.id;
  li.classList.add('__gmqm-peopleListItem');
  li.appendChild(clone);

  document.getElementById(SETTINGS_UI_ID.USER_LIST).appendChild(li);
};

const removeUser = (userDetails) => {
  const temp = getSettingsOverlay();
  const li = temp.querySelector(`#${userDetails.id}`);

  if (li) {
    li.remove();
  }
};

const toggleWrongState = (isWrong) => {
  if (isWrong) {
    const audio = getWrongAudio();

    if (audio) {
      audio.play();
    }

    document.getElementsByTagName('html')[0].classList.add('__gmqm-animation--wrong');
  } else {
    document.getElementsByTagName('html')[0].classList.remove('__gmqm-animation--wrong');
  }
};

const toggleCorrectState = (isCorrect) => {
  if (isCorrect) {
    const audio = getCorrectAudio();

    if (audio) {
      audio.play();
    }

    document.getElementsByTagName('html')[0].classList.add('__gmqm-animation--correct');
  } else {
    document.getElementsByTagName('html')[0].classList.remove('__gmqm-animation--correct');
  }
};

const toggleAskState = (isAsk) => {
  const temp = getSettingsOverlay();
  if (settingsOverlay) {
    temp.querySelector(`#${SETTINGS_UI_ID.ASK}`).disabled = isAsk;
    temp.querySelector(`#${SETTINGS_UI_ID.ANSWER}`).disabled = !isAsk;
    temp.querySelector(`#${SETTINGS_UI_ID.RESET}`).disabled = !isAsk;
    temp.querySelector(`#${SETTINGS_UI_ID.CLEAR_POINTS}`).disabled = !isAsk;
    temp.querySelector(`#${SETTINGS_UI_ID.WRONG}`).disabled = !isAsk;
    temp.querySelector(`#${SETTINGS_UI_ID.CORRECT}`).disabled = !isAsk;
    if (temp.classList.contains(USER_IS_QUIZ_MASTER_CLASS)) {
      let $input = temp.querySelector(`#${SETTINGS_UI_ID.CUSTOM_QUESTION_BOX} textarea`);
      let $cQBox = temp.querySelector(`#${SETTINGS_UI_ID.CUSTOM_QUESTION_BOX}`);
      if (!isAsk) {
        if (!$input.value) {
          temp.querySelector(`#${SETTINGS_UI_ID.QUESTION_BOX}`).classList.remove('disabled');
        } else {
          $input.focus();
          $input.select();
        }
        $cQBox.classList.remove('disabled');
        $cQBox.style.opacity = 1;
        $input.disabled = false;
      } else {
        temp.querySelector(`#${SETTINGS_UI_ID.QUESTION_BOX}`).classList.add('disabled');
        $cQBox.classList.add('disabled');
        $input.disabled = true;
        if (!$input.value) { 
          $cQBox.style.opacity = 0.3;
        }
      }
    }
  }
};

const addFastestAnswer = (userID) => {
  const temp = getSettingsOverlay();
  const ul = temp.querySelector(`#${SETTINGS_UI_ID.USER_LIST}`);

  removeFastestAnswer();

  if (ul) {
    const li = ul.querySelector(`#${userID}`);
    const existingItem = ul.querySelector(`.${USERS_FASTEST_ANSWER_CLASS}`);

    if (existingItem) {
      return;
    }

    ul.classList.add(`${USERS_FASTEST_ANSWER_CLASS}`);
    li !== null && li.classList.add(`${USERS_FASTEST_ANSWER_CLASS}`);
  }
};

const removeFastestAnswer = () => {
  const temp = getSettingsOverlay();
  const ul = temp.querySelector(`#${SETTINGS_UI_ID.USER_LIST}`);

  if (ul) {
    const items = ul.querySelectorAll(`.${USERS_FASTEST_ANSWER_CLASS}`);

    ul.classList.remove(`${USERS_FASTEST_ANSWER_CLASS}`);

    if (items.length) {
      items.forEach($li => $li.classList.remove(`${USERS_FASTEST_ANSWER_CLASS}`));
    }
  }
};

const setQuizMaster = (quizMasterId, currentUserId) => {
  const temp = getSettingsOverlay();
  const li = temp.querySelector(`#${quizMasterId}`);
  const checkbox = temp.querySelector(`#${SETTINGS_UI_ID.QUIZ_MASTER}`);

  console.log("QUIZMASTER", quizMasterId, currentUserId, currentUserId === quizMasterId);

  unsetQuizMaster(); // unset previous quiz master

  if (li) {
    li.classList.add(`${USERS_QUIZ_MASTER_CLASS}`);
  }

  if (checkbox) {
    if (quizMasterId === currentUserId) {

      settingsOverlay.classList.remove(USER_IS_PARTICIPANT_CLASS);
      settingsOverlay.classList.add(USER_IS_QUIZ_MASTER_CLASS);

      if (!checkbox.checked) {
        checkbox.checked = true;
      }
    } else {
      checkbox.disabled = true;
    }
  }

  if (isQuizMaster())  {
    const $div = document.getElementById(SETTINGS_UI_ID.QUESTION_BOX);
    const $div2 = document.getElementById(SETTINGS_UI_ID.CUSTOM_QUESTION_BOX);
    $div.classList.remove('__gmqm-hidden');
    $div2.classList.remove('__gmqm-hidden');
  }

};

const unsetQuizMaster = () => {
  const temp = getSettingsOverlay();
  const li = temp.querySelector(`.${USERS_QUIZ_MASTER_CLASS}`);
  const checkbox = temp.querySelector(`#${SETTINGS_UI_ID.QUIZ_MASTER}`);
  const input = temp.querySelector(`#${SETTINGS_UI_ID.CUSTOM_QUESTION_BOX} textarea`);

  console.log("UNSET_QUIZMASTER", li);

  if (li) {
    li.classList.remove(`${USERS_QUIZ_MASTER_CLASS}`);
  }

  if (checkbox) {
    settingsOverlay.classList.remove(USER_IS_QUIZ_MASTER_CLASS);
    settingsOverlay.classList.add(USER_IS_PARTICIPANT_CLASS);

    if (checkbox.checked) {
      checkbox.checked = false;
    }

    checkbox.disabled = false;
  }

  if (input) {
    input.value = '';
  }

  // Sometimes db_quiz_ask_reset_sync runs before unsetting quiz master
  // this is here to ensure clean up
  removeQuestion(false);
};

const updatePoints = (userPoints) => {
  const temp = getSettingsOverlay();
  const div = temp.querySelector(`#${userPoints.id} .${USERS_POINTS_WRAPPER_CLASS}`);
  const span = temp.querySelector(`#${userPoints.id} .${USERS_POINTS_CLASS}`);

  if (div && span) {
    div.dataset.points = userPoints.points;
    span.innerText = userPoints.points;
  }
};

const removePoints = (userPoints) => {
  const temp = getSettingsOverlay();
  const div = temp.querySelector(`#${userPoints.id} .${USERS_POINTS_WRAPPER_CLASS}`);
  const span = temp.querySelector(`#${userPoints.id} .${USERS_POINTS_CLASS}`);

  if (div && span) {
    div.dataset.points = 0;
    span.innerText = 0;
  }
};

const isQuizMaster = () => {
  return settingsOverlay.classList.contains(USER_IS_QUIZ_MASTER_CLASS);
}

const removeQuestion = async (mustBeQuizMaster) => {
  const temp = getSettingsOverlay();

  if (mustBeQuizMaster && !isQuizMaster()) {
    return;
  }

  if (!isQuizMaster()) {
    // Pre made questions
    const template = temp.querySelector(`#${SETTINGS_UI_ID.QUESTION_ITEM}`);
    const clone = template.content.cloneNode(true);
    // Questions
    const $div = document.getElementById(SETTINGS_UI_ID.QUESTION_BOX);
    $div.classList.remove('disabled');
    $div.style.opacity = 1;
    const $divClone = $div.cloneNode();
    $divClone.innerHTML = '';
    $divClone.appendChild(clone);
    $divClone.classList.add('__gmqm-hidden');
    
    $div.parentNode.replaceChild($divClone, $div);
    // Custom Questions
    const $div2 = document.getElementById(SETTINGS_UI_ID.CUSTOM_QUESTION_BOX);
    const $input = document.querySelector(`#${SETTINGS_UI_ID.CUSTOM_QUESTION_BOX} textarea`);
    $div2.classList.add('__gmqm-hidden');
  }

}

const showQuestion = async (questionId, mustBeQuizMaster) => {
  const temp = getSettingsOverlay();
  let q = await getQuestion(questionId);

  if (typeof questionId === 'string') {
    q = {
      'question': questionId
    };
  }

  if (q === undefined) {
    console.log("showQuestion: the requested question id could not be found ", questionId)
    return;
  }

  if (mustBeQuizMaster && !isQuizMaster()) {
    return;
  }

  // Quizmaster is typing there own question dont update
  if (isQuizMaster() && typeof questionId === 'string') {
    return;
  }

  const template = temp.querySelector(`#${SETTINGS_UI_ID.QUESTION_ITEM}`);

  const clone = template.content.cloneNode(true);

  const $p = clone.querySelector('p');
  $p.innerText = q.question;

  const $ul = clone.querySelector('ul');

  if (q.answers) {
    const $ul = clone.querySelector('ul');
    q.answers.forEach(answer => {
      let $li = document.createElement('li');
      $li.innerText = answer.text;
      answer.correct && isQuizMaster() ? $li.classList.add('__gmqm-questionAnswer') : null;
      $ul.appendChild($li);
    });
  }

  const $div = document.getElementById(SETTINGS_UI_ID.QUESTION_BOX);
  const $divClone = $div.cloneNode();
  $divClone.innerHTML = '';
  $divClone.classList.remove('__gmqm-hidden');
  $divClone.appendChild(clone);
  $div.parentNode.replaceChild($divClone, $div);

};

const getQuestion = async (question) => {
  const json = browser.runtime.getURL('trivia/questions.json');
  const response = await fetch(json);
  const questionsContent = await response.json();

  return questionsContent[question];
}

// TODO change this so questions don't repeat
const getRandomQuestionId = async () => {
  const json = browser.runtime.getURL('trivia/questions.json');
  const response = await fetch(json);
  const questionsContent = await response.json();

  return Math.floor(Math.random() * Math.floor(questionsContent.length));
}

const bindSettingsOverlayEvent = () => {
  const settingsOverlay = getSettingsOverlay();

  const participantVideo = document.querySelector('[data-allocation-index]');
  const container = participantVideo && participantVideo.parentElement;

  const meetingIdElem = document.querySelector('[data-unresolved-meeting-id]');
  const meetingID = meetingIdElem ? meetingIdElem.dataset.unresolvedMeetingId : null;

  if (!container || !meetingID) {
    console.log('no active meet session yet');
    return;
  }

  const userDetails = searchForUserDetails();

  document.getElementById(SETTINGS_UI_ID.ANSWER).onclick = async (event) => {
    event.target.disabled = true;
    try {
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'answer_quiz',
        meeting_id: meetingID,
        participant: userDetails
      });
    } catch (e) {
      console.error(e);
    }
  };

  document.getElementById(SETTINGS_UI_ID.QUESTION_WRAPPER).onclick = async (event) => {
    if (!isQuizMaster() ||
        !settingsOverlay.querySelector(`#${SETTINGS_UI_ID.RESET}`).disabled ||
        document.querySelector(`#${SETTINGS_UI_ID.CUSTOM_QUESTION_WRAPPER} textarea`).value.length > 0
      ) {
      return;
    }
    try {
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'question_quiz',
        meeting_id: meetingID,
        participant: userDetails,
        question_id: await getRandomQuestionId()
      });
    } catch (e) {
      console.error(e);
    }
  };

  document.getElementById(SETTINGS_UI_ID.CUSTOM_QUESTION_WRAPPER).onclick = async (event) => {
    if (!isQuizMaster() || !settingsOverlay.querySelector(`#${SETTINGS_UI_ID.RESET}`).disabled) {
      return;
    }
    
    const qWrapperEl = document.querySelector(`#${SETTINGS_UI_ID.CUSTOM_QUESTION_WRAPPER} textarea`);
    qWrapperEl.focus();
    if (event.target !== qWrapperEl) {
      qWrapperEl.select();
    }
  }; 

  document.querySelector(`#${SETTINGS_UI_ID.CUSTOM_QUESTION_WRAPPER} textarea`).oninput = async (event) => {
    const inputQuestion = event.target.value.slice(0, 255);

    if (!isQuizMaster() || !settingsOverlay.querySelector(`#${SETTINGS_UI_ID.RESET}`).disabled) {
      return;
    }

    const qBoxEl = document.querySelector(`#${SETTINGS_UI_ID.QUESTION_BOX}`);
    if (inputQuestion.length === 0) {
      // Enable trivia option
      qBoxEl.classList.remove('disabled');
      qBoxEl.style.opacity = 1;
    } else {
      // Disable triva option 
      qBoxEl.classList.add('disabled');
      qBoxEl.style.opacity = 0.3;
    }

    try {
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'custom_question_quiz',
        meeting_id: meetingID,
        participant: userDetails,
        question_text: inputQuestion
      });
    } catch (e) {
      console.error(e);
    }
  };

  document.getElementById(SETTINGS_UI_ID.ASK).onclick = async (event) => {
    if (!isQuizMaster()) {
      return;
    }
    try {
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'ask_quiz',
        meeting_id: meetingID,
        participant: userDetails
      });
    } catch (e) {
      console.error(e);
    }
  };

  document.getElementById(SETTINGS_UI_ID.RESET).onclick = async (event) => {
    if (!isQuizMaster()) {
      return;
    }
    try {
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'reset_quiz',
        meeting_id: meetingID,
        participant: userDetails
      });
    } catch (e) {
      console.error(e);
    }
  };

  document.getElementById(SETTINGS_UI_ID.CLEAR_POINTS).onclick = async (event) => {
    if (!isQuizMaster()) {
      return;
    }
    try{
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'clear_all_quiz_points',
        meeting_id: meetingID,
        participant: userDetails
      });
    } catch (e) {
      console.error(e);
    }
  };

  document.getElementById(SETTINGS_UI_ID.WRONG).onclick = async (event) => {
    if (!isQuizMaster()) {
      return;
    }
    if (answerWrongTimeout) {
      clearTimeout(answerWrongTimeout);
      answerWrongTimeout = null;
    }

    try {
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'wrong_quiz_answer',
        meeting_id: meetingID,
        participant: userDetails
      });
    } catch (e) {
      console.error(e);
    }

    answerWrongTimeout = setTimeout(async () => {
      try{
        await port.postMessage({
          sender: 'toaster_quiz_master_content',
          type: 'reset_wrong_quiz_answer',
          meeting_id: meetingID,
          participant: userDetails
        });
      } catch (e) {
        console.error(e);
      }
    }, 1000);
  };

  document.getElementById(SETTINGS_UI_ID.CORRECT).onclick = async (event) => {
    if (!isQuizMaster()) {
      return;
    }
    if (answerCorrectTimeout) {
      clearTimeout(answerCorrectTimeout);
      answerCorrectTimeout = null;
    }

    try{
      await port.postMessage({
        sender: 'toaster_quiz_master_content',
        type: 'correct_quiz_answer',
        meeting_id: meetingID,
        participant: userDetails
      });
    } catch (e) {
      console.error(e);
    }

    answerCorrectTimeout = setTimeout(async () => {
      try{
        await port.postMessage({
          sender: 'toaster_quiz_master_content',
          type: 'reset_correct_quiz_answer',
          meeting_id: meetingID,
          participant: userDetails
        });
      } catch (e) {
        console.error(e);
      }
    }, 1000);
  };

  settingsOverlay.querySelector(`#${SETTINGS_UI_ID.QUIZ_MASTER}`).onchange = async (event) => {
    if (event.target.checked) {
      try{
        await port.postMessage({
          sender: 'toaster_quiz_master_content',
          type: 'set_quiz_master',
          meeting_id: meetingID,
          participant: userDetails
        });
      } catch (e) {
        console.error(e);
      }
    } else {
      try{
        await port.postMessage({
          sender: 'toaster_quiz_master_content',
          type: 'unset_quiz_master',
          meeting_id: meetingID,
          participant: userDetails
        });
      } catch (e) {
        console.error(e);
      }
    }
  };
};

const injectSettingsOverlayUI = async () => {
  // get settings template
  const template = browser.runtime.getURL('settings-template.html');

  const templateContent = await fetch(template);

  const settingsOverlay = document.createElement('div');
  settingsOverlay.id = SETTINGS_OVERLAY_ID;

  settingsOverlay.classList.add('__gmqm-container', '__gmqm-hidden', USER_IS_PARTICIPANT_CLASS);

  document.body.appendChild(settingsOverlay);
  settingsOverlay.innerHTML = await templateContent.text();

  bindSettingsOverlayEvent();

  return settingsOverlay;
};

export {
  injectSettingsOverlayUI,
  getSettingsOverlay,
  QUIZ_MASTER_WRONG_AUDIO_ID,
  QUIZ_MASTER_CORRECT_AUDIO_ID,
  toggleCorrectState,
  toggleWrongState,
  toggleAskState,
  hideSettingsUI,
  showSettingsUI,
  toggleSettingsUI,
  addUser,
  removeUser,
  addFastestAnswer,
  removeFastestAnswer,
  updatePoints,
  removePoints,
  setQuizMaster,
  unsetQuizMaster,
  getQuestion,
  showQuestion,
  removeQuestion,
  showAppShell,
  hideAppShell
};
