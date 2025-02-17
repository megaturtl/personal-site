(() => {
  // src/assets/js/turtl-movement.js
  var turtlControls = (() => {
    const config = {
      TRIGGER: "click",
      // Trigger type (click, mouseover, etc.)
      STATES: {
        IDLE: "/assets/images/turtl-sleep.gif",
        JUMP: "/assets/images/turtl-jump.gif",
        BOP: "/assets/images/turtl-bop.gif"
      },
      ANIMATION_DURATIONS: {
        JUMP: 52 / 12 * 1e3,
        // Duration of jump animation before reverting (frames/fps)
        BOP: 0
        // Bop continues until something else happens
      }
    };
    let idleTimeout, currentState = "IDLE", prevState = "IDLE", blockUntil = 0, turtlElement = null;
    const setTurtlState = (state, remember = true) => {
      if (!turtlElement)
        return;
      const now = Date.now();
      if (now < blockUntil)
        return;
      if (state !== "JUMP" && state === currentState)
        return;
      if (remember && state !== "JUMP") {
        prevState = state;
      }
      currentState = state;
      turtlElement.src = `${config.STATES[state]}?t=${now}`;
      clearTimeout(idleTimeout);
      if (state === "JUMP") {
        blockUntil = now + config.ANIMATION_DURATIONS.JUMP;
        idleTimeout = setTimeout(() => {
          blockUntil = 0;
          setTurtlState(prevState);
        }, config.ANIMATION_DURATIONS.JUMP);
      }
    };
    const getCurrentState = () => currentState;
    const handleTrigger = () => {
      if (!turtlElement)
        return;
      setTurtlState("JUMP", false);
    };
    const init = () => {
      turtlElement = document.getElementById("turtl");
      if (!turtlElement)
        return;
      setTurtlState("IDLE");
      turtlElement.addEventListener(config.TRIGGER, handleTrigger);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
    return {
      setTurtlState,
      getCurrentState
    };
  })();
  window.turtlControls = turtlControls;
})();
//# sourceMappingURL=turtl-movement.js.map
