document.addEventListener("DOMContentLoaded", () => {
  const taskInput = document.getElementById("taskInput");
  const optionInput = document.getElementById("optionInput");
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
    addTask: (task) => {
      const newTask = task.trim();
      if (newTask === "") return ;
      tasks.push({ task: newTask, important: false, urgent: false });
    }
  }

  addTaskButton.addEventListener("click", () => {
    taskInput.value.split('\n')
      .map(v => v.startsWith(optionInput.value) ? v.substring(optionInput.value.length) : null)
      .filter(v => v)
      .forEach(v => call("addTask", v))
    taskInput.value = ""
    optionInput.value = ""
  });

  renderTasks();
});
