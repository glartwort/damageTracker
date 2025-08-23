const MODULE_ID = "DamageTracker";
var isDebug = false;

console.log(MODULE_ID, "|", MODULE_ID, "is loaded.");

Hooks.on("clientSettingChanged", (settingKey, newValue) => {
  if (settingKey === MODULE_ID+".isDebug") {
    console.log(MODULE_ID, "|", `"isDebug" setting changed to: ${newValue}`);

    isDebug = newValue;
  }
});

//TODO: Should listen for damage "reverts" and clear that data

Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
  if (isDebug) console.log(MODULE_ID, "|", "preCreateChatMessage call detected");

  if (!message?.constructor?.name || message.constructor.name !== "ChatMessagePF2e") return;
  
  if (isDebug) console.log(MODULE_ID, "|", "ChatMessagePF2e call detected");

  if (data.flags.pf2e.context.type === "damage-taken") {
    
    //TODO: if you try applying damage to someone at 0, this attempts to read null
    if (!message.flags.pf2e.appliedDamage.updates) return;    

    const isNPCLoggingEnabled =  game.settings.get(MODULE_ID, "enableNPCTracking");
  
    const attackerId =  data.flags.pf2e.origin.actor;
    const attackActor = fromUuidSync(attackerId);
    const damageRegex = /span>\stakes\s(\d+)\sdamage./;
    const damageString = data.content;
    const damage =      message.flags.pf2e.appliedDamage.updates[0].value;
    const attacker =    attackActor.name;
    const isNPC =       (attackActor.type !== "character");
    const victim =      fromUuidSync(data.flags.pf2e.appliedDamage.uuid).name;
    const npcTrackEnabled = game.settings.get(MODULE_ID, "enableNPCTracking");
    
    if ((!isNPC) || (isNPCLoggingEnabled)) {
      let damageAmt = 0;
      const dmgMatch = damageString.match(damageRegex);

      if (dmgMatch) {
            damageAmt = parseInt(dmgMatch[1],10);
      }
      
      if (isDebug) {
        console.log(MODULE_ID, "|", "Damage Taken!");
        console.log(MODULE_ID, "|", "damage Amount: \t", damageAmt);
        console.log(MODULE_ID, "|", "damage: \t", damage);
        console.log(MODULE_ID, "|", "attacker: \t", attacker);
        console.log(MODULE_ID, "|", "attacker is NPC?:", isNPC)
        console.log(MODULE_ID, "|", "victim: \t", victim);
        console.log(MODULE_ID, "|", "track NPCs?", npcTrackEnabled);
      }

      AddOrMergeActor(attackerId, attacker, isNPC, damageAmt, damage);
    }
  }
 });

 async function AddOrMergeActor(key, name, isNPC, damageRoll, damage) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
    
  if (!actorMap[key]) {   //create new actor in damageMap
    actorMap[key] = {};
    actorMap[key].name = name;
    actorMap[key].isNPC = isNPC;
    actorMap[key].maxDmgRoll = damageRoll;
    actorMap[key].maxDmg = damage;
    actorMap[key].totDmg = damage;

    const Actortype = (isNPC)?"NPC":"PC";
    
    if (isDebug) console.log(MODULE_ID, "|", "Created new", Actortype, "for:", name, "with", damage, "damage.");
  } 
  else {    //actor already exists, update
    const existing = actorMap[key];
    const Actortype = (existing.isNPC)?"NPC":"PC";
    
    actorMap[key].maxDmgRoll = Math.max(existing.maxDmgRoll, damageRoll);
    actorMap[key].maxDmg = Math.max(existing.maxDmg, damage);
    actorMap[key].totDmg = existing.totDmg + damage;

    if (isDebug) console.log(MODULE_ID, "|", "Merged data into existing", Actortype, "for:", existing.name, "with", damage, "damage.");
  }
  await game.settings.set(MODULE_ID, "damageMap", actorMap);
}
