app "Priorities" target slate
table task name text, quad pick Urgent|Important|Both|Neither = Important
grid 2 gap 1
  each options task.quad as b
    stack card gap 1
      text b head
      each task where quad = b
        row
          it.name grow
          button "Move" tap edit it
          button "Done" tap remove it
form task, "Add task"
