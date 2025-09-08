const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

//new v2 version
class DamageTrackerSettings extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);

    if (game.user.isGM) {
      DamageTrackerSettings.PARTS.topButtons.template =
        'modules/damage-tracker/templates/partials/topButtons.hbs';
    }
  }

  static DEFAULT_OPTIONS = {
    tag: 'form',
    position: {width: 500, height: 'auto'},
    window: {title: "Damage Tracker Details", resizable: true},
    form: {
      handler: DamageTrackerSettings.onSubmitForm,
      closeOnSubmit: true
    },
  };

  static PARTS = {
    topButtons: {template: `modules/${MODULE_ID}/templates/partials/blank.hbs`},
    content: {template: `modules/${MODULE_ID}/templates/partials/tableContent.hbs`},
    PCgrouping: {template: `modules/${MODULE_ID}/templates/partials/PCgrouping.hbs`},
    exportButton: {template: `modules/${MODULE_ID}/templates/partials/exportButton.hbs`},
  }

  sortKey = "totDmg";   //writeable properties so the user can change them
  isSortAsc = false;    //writeable properties so the user can change them
  isGroupPCs = false;   //writeable properties so the user can change them

  get document() {
    return this.options.document;
  }

  get title() {
    return this.options.window.title;
  }

  async _onRender(context,options) {
    const html = this.element;

    if(!this._listenersBound) {
      html.querySelector(".clear-tracking-button")?.addEventListener("click", this.#onClearTrackingClick.bind(this));
      html.querySelector(".clear-NPCs-button")?.addEventListener("click", this.#onClearNPCsClick.bind(this));
      html.querySelector(".export-damage-map")?.addEventListener("click", this.#onExportDamageMapClick.bind(this));
      html.querySelector(".group-PCs")?.addEventListener("click", this.#onGroupPCsClick.bind(this));

      this.#registerContentEventHandlers();

      // Start refresh loop - only set when listeners are initially bound 
      // i.e. don't check this every render
      if (!this._pollInterval) {
        this.refreshContent();
        this._pollInterval = setInterval(() => {
          if (this.rendered) this.refreshContent();
        }, 3000); // 3 seconds
      }
    }
  }

  _getSortedActorData() {
    const dmgMap = game.settings.get(MODULE_ID, "damageMap");
    
    const key = this.sortKey;
    const asc = this.isSortAsc;
    
    const sortedActors = Object.values(dmgMap).sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      if (aVal == null) aVal = "";
      if (bVal == null) bVal = "";

      if ((typeof aVal === "number")&& (typeof bVal === "number")) {   //numeric sort
        return asc?aVal-bVal:bVal-aVal;
      }
      
      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();

      return asc?aVal.localeCompare(bVal):bVal.localeCompare(aVal);
    });

    if (this.isGroupPCs)
      return [...sortedActors.filter(a => !a.isNPC), ...sortedActors.filter(a => a.isNPC)];
    else
      return sortedActors;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const sortedActors = this._getSortedActorData();

    if (isDebug) {
      console.log(LOG_PREFIX, "DamageTracker Actor list: ");
      console.log(LOG_PREFIX, sortedActors);
    }   

    return {
      actors: sortedActors,
      sortKey: this.sortKey,
      isSortAsc: this.isSortAsc
    };  
  }

  static async onSubmitForm(event, form, formData) {
    const settings = foundry.utils.expandObject(formData.object);
    await Promise.all(
        Object.entries(settings)
            .map(([key, value]) => game.settings.set(MODULE_ID, key, value))
    );
  }
  
  //Click Handlers
  async #onClearTrackingClick(event) {
    event.preventDefault();
    
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: {title: "Clear Tracking Data?"},
      content: "Are you sure you want to proceed?",
      rejectClose: false,
      modal: true
    });

    if (proceed) {
      await game.settings.set(MODULE_ID, "damageMap", {});
      ui.notifications.info("Damage tracking data has been cleared.");

      //refresh Settings page since data changed.
      this.refreshContent();
    }
  }

  async #onClearNPCsClick(event) {
    event.preventDefault();
        
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: {title: "Clear NPC Data?"},
      content: "Are you sure you want to proceed?",
      rejectClose: false,
      modal: true
    });
   
    if (proceed) {
      const dmgMap = game.settings.get(MODULE_ID,"damageMap");
      
      //filter to only PCs and set damage map to new filtered set.
      const filteredActors = Object.values(dmgMap).filter((a) => !a.isNPC);

      const newDmgMap = {};

      filteredActors.forEach(actor => {
        newDmgMap[actor.key] = {
          name: actor.name,
          isNPC: actor.isNPC,
          maxDmgRoll: actor.maxDmgRoll,
          maxDmg: actor.maxDmg,
          totDmg: actor.totDmg
        }
      });
      
      await game.settings.set(MODULE_ID, "damageMap", newDmgMap);
      ui.notifications.info("Damage tracking data for NPCs has been cleared.");

      //refresh Settings page since data changed.
      this.refreshContent();
    }  
  }
  
 #onExportDamageMapClick(event) {
    var exportData = "Actor Name, isNPC, Max Damage Roll, Max Damage, Total Damage\n";
    const dmgMap = game.settings.get(MODULE_ID,"damageMap");
    const sortedActors = this._getSortedActorData();

    sortedActors.forEach(actor => {
      exportData += `${actor.name}, ${actor.isNPC}, ${actor.maxDmgRoll}, ${actor.maxDmg}, ${actor.totDmg}, ${actor.mostDmgTaken}\n`;
    });

    const expDialog = new foundry.applications.api.DialogV2({
      window: {
        title: "Export Damage Data (CSV)"
      },
      position: {width: 500, height: 'auto' },
      content: `<textarea readonly style="width:100%; height:300px;">${exportData}</textarea>`,
      buttons: [
        {
          action: "close",
          label: "Close",
          callback: () => ui.notifications.info("Dialog closed.")
        }
      ],
      rejectClose: true,
      modal:false
    });
    
    expDialog.render(true);
  }

  #onGroupPCsClick(event) {
    this.isGroupPCs = !this.isGroupPCs;
    this.refreshContent();
  }

  #onSortableClick(event) { 
    const key = event.currentTarget.dataset.key;
  
    if (this.sortKey === key) {
      this.isSortAsc = !this.isSortAsc; // toggle direction
    } else {
      this.sortKey = key;
      this.isSortAsc = (key === "name")?true:false; // default to ascending for name, descending for everything else
    }

    this.refreshContent();
  }

  #registerContentEventHandlers() {
    this.element?.querySelectorAll(".sortable").forEach( el => {
      const key = el.dataset.key;

      if (!key) return;

      el.addEventListener("click", this.#onSortableClick.bind(this));
    });
  }

  async refreshContent() {
    const container = this.element?.querySelector(".damageTable");  //top element of tableContent.hbs
    if (!container) return;

    // Render the partial template
    const newHTML = await renderTemplate(DamageTrackerSettings.PARTS.content.template, { actors: this._getSortedActorData(), sortKey: this.sortKey, isSortAsc: this.isSortAsc });
    
    // Replace the content
     container.innerHTML = newHTML;

    this.#registerContentEventHandlers();
  }

  close() {
    if (this._pollInterval) {
      clearInterval(this._pollInterval);
    }
    super.close();
    if (isDebug) console.log(MODULE_ID, "| removed refresh timer, closed activelisteners");
  }
}
