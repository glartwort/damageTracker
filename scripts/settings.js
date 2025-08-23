console.log(MODULE_ID, "- Settings.js is loaded.");

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "settingsMenu", {
    name: "Details",
    label: "Details",
    hint: "See damage from each actor, configure detailed settings.",
    type: DamageTrackSettings,
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

  game.settings.register(MODULE_ID, "clearTracking", {
    name: "Reset all tracked data for Damage Track",
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

  console.log("## ", MODULE_ID, " settings registered ##");
});