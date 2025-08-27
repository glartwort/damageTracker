let myFormAppInstance;

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "settingsMenu", {
    name: "Details",
    label: "Details",
    hint: "See damage from each actor, configure detailed settings.",
    type: DamageTrackerSettings,
    restricted: false
  });

  game.keybindings.register(MODULE_ID, 'openMyFormApp', {
    name: 'Open Damage Tracker Details page',
    hint: 'Press this key to open the Damage Tracker Details',
    editable: [
      {
        key: 'KeyD',
        modifiers: ['Control']
      }
    ],
    onDown: () => {
      if (myFormAppInstance?.rendered) {
        myFormAppInstance.close();
      } else {
        myFormAppInstance = new DamageTrackerSettings();
        myFormAppInstance.render(true);
      }
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });

  game.settings.register(MODULE_ID, "enableNPCTracking", {
    name: "NPC Damage Tracking",
    hint: "Should NPCs show in the list?",
    scope: "world",
    config: true,
    type: Boolean,
    requiresReload: false,
    default: true
  });

  game.settings.register(MODULE_ID, "isDebug", {
    name: "{Damage Tracker debug logging}",
    hint: "Should Damage Tracker log to console with debug info?",
    scope: "client",
    config: true,
    type: Boolean,
    requiresReload: false,
    default: false
  });

  game.settings.register(MODULE_ID, "damageMap", {
    name: "Damage Map",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });


  isDebug = game.settings.get(MODULE_ID, "isDebug");

  if (isDebug) console.log(LOG_PREFIX, "settings registered.");
});