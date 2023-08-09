document.addEventListener("DOMContentLoaded", () => {
  const taskLists = [
    [document.getElementById("importantUrgent"), document.getElementById("importantNotUrgent")],
    [document.getElementById("notImportantUrgent"), document.getElementById("notImportantNotUrgent")]
  ];

  let tasks = []

  function updateMatrixFromStorage() {
    if (localStorage.getItem("tasks") === JSON.stringify(tasks))
      return ;
    tasks = JSON.parse(localStorage.getItem("tasks")) || [];
    renderMatrix();
  }

  function renderMatrix() {
    taskLists.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        cell.innerHTML = tasks
          .filter(task => evaluateTask(task, rowIndex, columnIndex))
          .map(task => `<li>${task.task}</li>`)
          .join("");
      });
    });
  }

  const evaluateTask = (task, rowIndex, columnIndex) =>
    task.important === (rowIndex === 0) && task.urgent === (columnIndex === 0);
  
  setInterval(updateMatrixFromStorage, 300);
  updateMatrixFromStorage();

});
