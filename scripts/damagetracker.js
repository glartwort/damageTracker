const MODULE_ID = "damage-tracker";
const UNIDENTIFIED_ATTACKER = "<Unidentified source>";
var isDebug = false;

console.log(MODULE_ID, "|", MODULE_ID, "is loaded.");

Hooks.on("clientSettingChanged", (settingKey, newValue) => {
  if (settingKey === MODULE_ID+".isDebug") {
    console.log(MODULE_ID, "|", `"isDebug" setting changed to: ${newValue}`);

    isDebug = newValue;
  }
});

Hooks.on("preCreateChatMessage", (message, data, options, userId) => {
  if (isDebug) console.log(MODULE_ID, "|", "preCreateChatMessage call detected");

  if (!message?.constructor?.name || message.constructor.name !== "ChatMessagePF2e") return;
  
  if (isDebug) console.log(MODULE_ID, "|", "ChatMessagePF2e call detected");

  if (message.flags.pf2e.context?.type === "damage-taken") {
    const isNPCLoggingEnabled =  game.settings.get(MODULE_ID, "enableNPCTracking");
    let attackerId =  data.flags.pf2e.origin?.actor;
    const attackActor = (attackerId)?fromUuidSync(attackerId):null;
    const attacker =    (attackActor)?attackActor.name:UNIDENTIFIED_ATTACKER;
    let isNPC =       (attackActor?.type !== "character");

    if (!attackerId) {  //invalid attackerId usually indicates manually applied damage (or unarmed strikes)
      isNPC =       false;      // since it might be from a PC, we need to treat it as such
      attackerId =  UNIDENTIFIED_ATTACKER;  //give it a value since checking a null key isn't good
    }

    const damageRegex = /span>\stakes\s(\d+)\sdamage./;
    const damageString = data.content;
    const validUpdate = message.flags.pf2e.appliedDamage?.updates;  //if missing, 0 damage done - process to get damageRoll anyway
    const damage =      (validUpdate)?validUpdate[0].value:0;
    const victim =      fromUuidSync(data.flags.pf2e.appliedDamage?.uuid)?.name;
        
    if ((!isNPC) || (isNPCLoggingEnabled)) {
      let damageRoll = 0;
      const dmgMatch = damageString.match(damageRegex);

      if (dmgMatch) {
            damageRoll = parseInt(dmgMatch[1],10);
      }
      
      if (isDebug) {
        console.log(MODULE_ID, "|", "Damage Taken!");
        console.log(MODULE_ID, "|", "damage Amount: \t", damageRoll);
        console.log(MODULE_ID, "|", "damage: \t", damage);
        console.log(MODULE_ID, "|", "attacker: \t", attacker);
        console.log(MODULE_ID, "|", "attacker is NPC?:", isNPC)
        console.log(MODULE_ID, "|", "victim: \t", victim);
        console.log(MODULE_ID, "|", "track NPCs?", isNPCLoggingEnabled);
      }

      AddOrMergeActor(attackerId, attacker, isNPC, damageRoll, damage);
    }
  }
});

 //TODO: Should listen for damage "reverts" and clear that data
Hooks.on("preUpdateChatMessage", (message, data, options, userId) => {
  if (isDebug) console.log(MODULE_ID, "|", "preUpdateChatMessage call detected");

  if (!message?.constructor?.name || message.constructor.name !== "ChatMessagePF2e") return;
    
  if (isDebug) console.log(MODULE_ID, "|", "ChatMessagePF2e call detected");

  if (message.flags.pf2e.context?.type === "damage-taken") {
      
    if (!message.flags.pf2e.appliedDamage.updates) return;    

    if (data.flags.pf2e.appliedDamage.isReverted)
    {
      if (isDebug) console.log(MODULE_ID, "|", "Revert damage found");

      let attackerId =  message.flags.pf2e.origin?.actor;
      const attackActor = (attackerId)?fromUuidSync(attackerId):null;
      let isNPC =       (attackActor?.type !== "character");

      if (!attackerId) {  //invalid attackerId usually indicates manually applied damage (or unarmed strikes)
        isNPC =       false;                  //since it might be from a PC, we need to treat it as such
        attackerId =  UNIDENTIFIED_ATTACKER;  //give it a value since checking a null key isn't good
      }

      const damageRegex = /span>\stakes\s(\d+)\sdamage./;
      const damageString = data.content;
      const damage =      message.flags.pf2e.appliedDamage.updates[0].value;
        
              
      let damageRoll = 0;
      const dmgMatch = damageString.match(damageRegex);

      if (!dmgMatch) 
         return;
        
      damageRoll = parseInt(dmgMatch[1],10);
        
      if (isDebug) {
        console.log(MODULE_ID, "|", "Damage Reverted!");
        console.log(MODULE_ID, "|", "damage: \t", damage);
      }

      RevertDamage(attackerId, damageRoll, damage);
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

async function RevertDamage(key, damageRoll, damage) {
  const actorMap = game.settings.get(MODULE_ID, "damageMap") ?? {};
    
  if (!actorMap[key]) {   //create new actor in damageMap
    if (isDebug) console.log(MODULE_ID, "|", "Actor is not in the table to revert damage from");
  } 
  else {    //actor already exists, update
    const existing = actorMap[key];
    const Actortype = (existing.isNPC)?"NPC":"PC";
    
    if (actorMap[key].maxDmgRoll = damageRoll) {
      actorMap[key].maxDmgRoll = 0;
    }    
    
    if (actorMap[key].maxDmg = damage) {
      actorMap[key].maxDmg = 0;
    }

    actorMap[key].totDmg = existing.totDmg - damage;

    if (isDebug) console.log(MODULE_ID, "|", "Reverted damage from existing", Actortype, "for:", existing.name, "with", damage, "damage.");
  }
  await game.settings.set(MODULE_ID, "damageMap", actorMap);
}
