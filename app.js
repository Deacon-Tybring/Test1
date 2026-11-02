(function () {
  "use strict";

  const storage = {
    get: function (key, fallback) {
      try {
        const saved = localStorage.getItem(key);
        return saved === null ? fallback : JSON.parse(saved);
      } catch (error) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (error) {
        return false;
      }
      return true;
    }
  };

  const plants = storage.get("littleLeafPlants", STARTER_PLANTS.map(function (plant) {
    return Object.assign({}, plant);
  }));
  const grid = document.getElementById("plant-grid");
  const searchBox = document.getElementById("search-box");
  const emptyMessage = document.getElementById("empty-message");
  const dialog = document.getElementById("plant-dialog");
  const form = document.getElementById("plant-form");
  const imageInput = document.getElementById("plant-image");
  const errorMessage = document.getElementById("form-error");
  const today = new Date();
  let activeFilter = "all";

  function localDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  function daysUntilWater(plant) {
    const due = new Date(plant.lastWatered + "T00:00:00");
    due.setDate(due.getDate() + Number(plant.interval));
    return Math.ceil((due - new Date(localDate(today) + "T00:00:00")) / 86400000);
  }

  function setImage(image, plant) {
    image.className = "plant-image";
    image.alt = plant.name + (plant.species ? ", " + plant.species : "");
    image.loading = "lazy";
    if (plant.image) {
      image.src = plant.image;
    } else {
      image.classList.add("image-missing");
      image.alt = "No photo added for " + plant.name;
    }
    image.addEventListener("error", function () {
      image.classList.add("image-missing");
      image.removeAttribute("src");
      image.alt = "Photo unavailable for " + plant.name;
    }, { once: true });
  }

  function makePlantCard(plant) {
    const card = document.createElement("article");
    card.className = "plant-card";
    const daysLeft = daysUntilWater(plant);
    const due = daysLeft <= 0;
    const photo = document.createElement("div");
    photo.className = "plant-photo";
    const image = document.createElement("img");
    setImage(image, plant);
    photo.append(image);

    const status = document.createElement("span");
    status.className = "plant-status" + (due ? " is-due" : "");
    status.textContent = due ? (daysLeft === 0 ? "WATER TODAY" : "WATER NOW") : "IN " + daysLeft + " DAYS";
    photo.append(status);

    const details = document.createElement("div");
    details.className = "plant-details";
    const title = document.createElement("h3");
    title.textContent = plant.name;
    const species = document.createElement("p");
    species.className = "plant-species";
    species.textContent = plant.species || "Your plant";
    const care = document.createElement("p");
    care.className = "care-note";
    care.textContent = "Every " + plant.interval + " days";
    const actions = document.createElement("div");
    actions.className = "plant-actions";
    const waterButton = document.createElement("button");
    waterButton.type = "button";
    waterButton.className = "water-button";
    waterButton.textContent = due ? "Watered today" : "Water now";
    waterButton.addEventListener("click", function () {
      plant.lastWatered = localDate(new Date());
      savePlants();
      renderPlants();
    });
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", "Remove " + plant.name);
    removeButton.addEventListener("click", function () {
      if (window.confirm("Remove " + plant.name + " from your garden?")) {
        const index = plants.findIndex(function (item) { return item.id === plant.id; });
        if (index !== -1) plants.splice(index, 1);
        savePlants();
        renderPlants();
      }
    });
    actions.append(waterButton, removeButton);
    details.append(title, species, care, actions);
    card.append(photo, details);
    return card;
  }

  function savePlants() {
    if (!storage.set("littleLeafPlants", plants)) {
      window.alert("Your garden could not be saved. Try using a smaller photo.");
    }
  }

  function renderPlants() {
    const query = searchBox.value.trim().toLowerCase();
    const matchingPlants = plants.filter(function (plant) {
      const matchesQuery = (plant.name + " " + plant.species).toLowerCase().includes(query);
      return matchesQuery && (activeFilter === "all" || daysUntilWater(plant) <= 0);
    });
    grid.replaceChildren.apply(grid, matchingPlants.map(makePlantCard));
    document.getElementById("plant-total").textContent = plants.length;
    document.getElementById("collection-count").textContent = "(" + plants.length + ")";
    const dueCount = plants.filter(function (plant) { return daysUntilWater(plant) <= 0; }).length;
    document.getElementById("due-total").textContent = dueCount;
    document.getElementById("summary-note").textContent = dueCount ? "A little drink will do them good." : "Small sips, happy plants.";
    document.getElementById("reminder-message").textContent = dueCount
      ? dueCount + (dueCount === 1 ? " plant is" : " plants are") + " ready for a drink today."
      : "Everyone is looking happy. No watering needed today.";
    document.getElementById("show-due").hidden = dueCount === 0;
    emptyMessage.hidden = matchingPlants.length > 0;
    if (plants.length === 0) {
      emptyMessage.querySelector("h3").textContent = "Your garden is ready to grow.";
      emptyMessage.querySelector("p").textContent = "Add a plant to start keeping track of watering days.";
    } else if (matchingPlants.length === 0) {
      emptyMessage.querySelector("h3").textContent = activeFilter === "due" ? "Nothing needs water right now." : "No plants found.";
      emptyMessage.querySelector("p").textContent = activeFilter === "due" ? "Your plants are all caught up." : "Try another name or plant type.";
    }
  }

  function openForm() {
    errorMessage.hidden = true;
    form.reset();
    document.getElementById("last-watered").value = localDate(new Date());
    document.getElementById("upload-label").textContent = "Choose an image from your device";
    dialog.showModal();
    document.getElementById("plant-name").focus();
  }

  function readImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        resolve("");
        return;
      }
      if (!file.type.startsWith("image/")) {
        reject(new Error("Choose an image file to continue."));
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        const source = new Image();
        source.onload = function () {
          const scale = Math.min(1, 900 / Math.max(source.width, source.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.round(source.width * scale);
          canvas.height = Math.round(source.height * scale);
          canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        source.onerror = function () { reject(new Error("That image could not be opened.")); };
        source.src = reader.result;
      };
      reader.onerror = function () { reject(new Error("That image could not be read.")); };
      reader.readAsDataURL(file);
    });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const submitButton = form.querySelector("[type=submit]");
    submitButton.disabled = true;
    errorMessage.hidden = true;
    try {
      const image = await readImage(imageInput.files[0]);
      const formData = new FormData(form);
      const plant = {
        id: "plant-" + Date.now(),
        name: formData.get("name").trim(),
        species: formData.get("species").trim(),
        interval: Number(formData.get("interval")),
        lastWatered: formData.get("lastWatered"),
        image: image
      };
      plants.unshift(plant);
      savePlants();
      dialog.close();
      searchBox.value = "";
      activeFilter = "all";
      updateFilterButtons();
      renderPlants();
    } catch (error) {
      errorMessage.textContent = error.message || "The plant could not be added.";
      errorMessage.hidden = false;
    } finally {
      submitButton.disabled = false;
    }
  });

  function updateFilterButtons() {
    document.querySelectorAll(".filter-button").forEach(function (button) {
      const selected = button.dataset.filter === activeFilter;
      button.classList.toggle("is-active", selected);
      button.setAttribute("aria-pressed", selected ? "true" : "false");
    });
  }

  document.getElementById("today-date").textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric"
  }).format(today);
  document.getElementById("open-form").addEventListener("click", openForm);
  document.getElementById("empty-add").addEventListener("click", openForm);
  document.getElementById("close-form").addEventListener("click", function () { dialog.close(); });
  document.getElementById("cancel-form").addEventListener("click", function () { dialog.close(); });
  document.getElementById("show-due").addEventListener("click", function () {
    activeFilter = "due";
    updateFilterButtons();
    renderPlants();
    document.getElementById("plants-heading").scrollIntoView({ behavior: "smooth" });
  });
  document.querySelectorAll(".filter-button").forEach(function (button) {
    button.addEventListener("click", function () {
      activeFilter = button.dataset.filter;
      updateFilterButtons();
      renderPlants();
    });
  });
  searchBox.addEventListener("input", renderPlants);
  imageInput.addEventListener("change", function () {
    document.getElementById("upload-label").textContent = imageInput.files[0]
      ? imageInput.files[0].name
      : "Choose an image from your device";
  });

  if (storage.get("littleLeafPlants", null) === null) savePlants();
  renderPlants();
})();
