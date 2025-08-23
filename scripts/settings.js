Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "settingsMenu", {
    name: "Details",
    label: "Details",
    hint: "See damage from each actor, configure detailed settings.",
    type: DamageTrackerSettings,
    restricted: false
  });

  game.settings.register(MODULE_ID, "enableNPCTracking", {
    name: "NPC Damage Tracking",
    hint: "Should NPCs show in the list?",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "isDebug", {
    name: "{Damage Tracker debug logging}",
    hint: "Should Damage Tracker log to console with debug info?",
    scope: "client",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "clearTracking", {
    name: "Reset all tracked data for Damage Tracker",
    hint: "Clear all Damage Tracking data.",
    scope: "world",
    config: false,
    type: Boolean,
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

  if (isDebug) console.log(MODULE_ID, "|", "settings registered.");
});