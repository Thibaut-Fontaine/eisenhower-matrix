document.addEventListener("DOMContentLoaded", () => {
  const taskInput = document.getElementById("taskInput");
  const addTaskButton = document.getElementById("addTask");
  const taskList = document.getElementById("taskList");

  let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

  const saveTasks = () => localStorage.setItem("tasks", JSON.stringify(tasks));

  const renderTasks = () => {
    taskList.innerHTML = tasks
      .map((task, index) => `
        <li>
          <div>
            <input type="checkbox" class="important" ${task.important ? "checked" : ""}>
            <input type="checkbox" class="urgent" ${task.urgent ? "checked" : ""}>
          </div>
          <span>${task.task}</span>
          <button class="delete" />
        </li>
      `)
      .join("");

    taskList.querySelectorAll("li").forEach((li, index) => {
      li.querySelector(".important").addEventListener("click", () => call("toggleProperty", index, "important"));
      li.querySelector(".urgent").addEventListener("click", () => call("toggleProperty", index, "urgent"));
      li.querySelector(".delete").addEventListener("click", () => call("removeTask", index));
    });
  };

  const call = (name, index, args) => {
    actions[name](index, args)
    saveTasks();
    renderTasks();
  }

  const actions = {
    toggleProperty: (index, property) => tasks[index][property] = !tasks[index][property],
    removeTask: (index) => tasks.splice(index, 1),
  }

  addTaskButton.addEventListener("click", () => {
    const newTask = taskInput.value.trim();
    if (newTask === "") {
      return
    }
    tasks.push({ task: newTask, important: false, urgent: false });
    taskInput.value = "";
    saveTasks();
    renderTasks();
  });

  taskInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addTaskButton.click();
    }
  });

  renderTasks();
});
