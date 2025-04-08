from ortools.sat.python import cp_model
import pandas as pd
from fetch_data import fetch_data  # Import the fetch_data function
from datetime import datetime, timedelta
import sqlalchemy as sa
from sqlalchemy import create_engine
from dotenv import load_dotenv
import os
import tkinter as tk
from tkcalendar import DateEntry
import tkinter.ttk as ttk
import webbrowser
import sys
from io import StringIO
import random
import time

# Load environment variables from .env file
load_dotenv()

# Retrieve database credentials from environment variables
DB_HOST = os.getenv("DB_HOST")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASS = os.getenv("DB_PASS")
DB_PORT = os.getenv("DB_PORT")

# Create SQLAlchemy engine
connection_string = f"postgresql+psycopg2://{DB_USER}:{DB_PASS}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(connection_string)

# Function to convert time strings (e.g., "08:00:00") to minutes since midnight
def time_to_minutes(time_str):
    if pd.isna(time_str):
        return 0
    time_obj = datetime.strptime(str(time_str), "%H:%M:%S")
    return time_obj.hour * 60 + time_obj.minute

# Function to map elapsed minutes to a datetime, respecting working hours
def elapsed_minutes_to_datetime(elapsed_minutes, start_date, working_hours):
    current_date = start_date
    remaining_minutes = elapsed_minutes
    total_minutes = 0
    start_minutes = 0  # Initialize to avoid UnboundLocalError
    max_days = 365  # Arbitrary limit to prevent infinite loops

    day_count = 0
    while remaining_minutes > 0 and day_count < max_days:
        # Determine the weekday for the current date (1 = Monday, 7 = Sunday)
        weekday = current_date.isoweekday()  # 1 = Monday, 7 = Sunday
        start_minutes, end_minutes = working_hours.get(weekday, (0, 0))

        if start_minutes == end_minutes:  # Non-working day
            current_date += timedelta(days=1)
            day_count += 1
            continue

        # Calculate available minutes in the current day
        day_start = total_minutes
        day_end = total_minutes + (end_minutes - start_minutes)

        if remaining_minutes <= (end_minutes - start_minutes):
            # The elapsed minute falls within this day
            minutes_into_day = start_minutes + remaining_minutes
            return current_date + timedelta(minutes=minutes_into_day)

        # Move to the next day
        remaining_minutes -= (end_minutes - start_minutes)
        total_minutes += (end_minutes - start_minutes)
        current_date += timedelta(days=1)
        day_count += 1

    # If we run out of days or no working day is found, find the next working day
    while day_count < max_days:
        weekday = current_date.isoweekday()
        start_minutes, end_minutes = working_hours.get(weekday, (0, 0))
        if start_minutes != end_minutes:  # Working day found
            return current_date + timedelta(minutes=start_minutes)
        current_date += timedelta(days=1)
        day_count += 1

    # Fallback: return the start_date if no working day is found within max_days
    print(f"Warning: Could not find a working day within {max_days} days from {start_date}. Returning start_date.")
    return start_date

# Main scheduling function
def schedule_jobs(start_date, output_buffer):
    # Redirect print statements to the output buffer
    sys.stdout = output_buffer

    # Fetch data from the database
    data = fetch_data()
    if data is None:
        print("Failed to fetch data. Exiting.")
        return None

    jobs_df = data["jobs"]
    tasks_df = data["tasks"]
    resources_df = data["resources"]
    calendar_df = data["calendar"]
    resource_mapping = data["resource_mapping"]
    resource_group_mapping = data["resource_group_mapping"]

    # Step 1: Prepare working hours from calendar
    working_hours = {}
    for _, row in calendar_df.iterrows():
        day = row["weekday"]  # 1 to 7 (Monday to Sunday)
        start_minutes = time_to_minutes(row["start_time"])
        end_minutes = time_to_minutes(row["end_time"])
        working_hours[day] = (start_minutes, end_minutes)

    print("Working hours by weekday:")
    for day in range(1, 8):
        if day in working_hours:
            start_mins, end_mins = working_hours[day]
            print(f"  Day {day}: {start_mins // 60}:{start_mins % 60:02d} to {end_mins // 60}:{end_mins % 60:02d}")
        else:
            print(f"  Day {day}: No working hours")

    # Step 2: Compute task durations and organize tasks by job
    job_tasks = {}
    all_tasks = []
    task_to_index = {}
    index = 0

    # Debug: Check for cycles in predecessor relationships
    def detect_cycle(task_id, visited, stack, task_to_index, all_tasks):
        if task_id not in task_to_index:
            return False
        task_idx = task_to_index[task_id]
        visited[task_idx] = True
        stack[task_idx] = True

        task = all_tasks[task_idx]
        if task["predecessors"]:
            for pred_task_number in task["predecessors"]:
                pred_task_id = (task["task_id"][0], pred_task_number)
                if pred_task_id not in task_to_index:
                    continue
                pred_idx = task_to_index[pred_task_id]
                if not visited[pred_idx]:
                    if detect_cycle(pred_task_id, visited, stack, task_to_index, all_tasks):
                        return True
                elif stack[pred_idx]:
                    print(f"Cycle detected involving task {task_id} and predecessor {pred_task_id}")
                    return True
        stack[task_idx] = False
        return False

    # Filter jobs: exclude completed or blocked jobs
    eligible_jobs = jobs_df[(jobs_df["completed"] == False) & (jobs_df["blocked"] == False)]
    print("\nEligible Jobs (not completed and not blocked):")
    for _, job in eligible_jobs.iterrows():
        print(f"  Job {job['job_number']}: ID={job['id']}, Completed={job['completed']}, Blocked={job['blocked']}")

    for job_id in eligible_jobs["id"]:
        job_number = eligible_jobs[eligible_jobs["id"] == job_id]["job_number"].iloc[0]
        quantity = eligible_jobs[eligible_jobs["id"] == job_id]["quantity"].iloc[0]
        job_tasks[job_number] = []

        # Get tasks for this job
        job_tasks_df = tasks_df[tasks_df["job_number"] == job_number]
        # Filter tasks: exclude completed tasks
        eligible_tasks = job_tasks_df[job_tasks_df["completed"] == False]
        print(f"\nTasks for Job {job_number}:")
        for _, task in job_tasks_df.iterrows():
            if task["completed"]:
                print(f"  Task {task['task_number']}: Excluded (Completed)")
            else:
                print(f"  Task {task['task_number']}: Included")

        for _, task in eligible_tasks.iterrows():
            task_id = (job_number, task["task_number"])
            # Ensure setup_time and time_each are numeric and handle None/NaN
            setup_time = float(task["setup_time"]) if pd.notna(task["setup_time"]) else 0
            time_each = float(task["time_each"]) if pd.notna(task["time_each"]) else 0
            quantity_val = float(quantity) if pd.notna(quantity) else 1

            # Calculate duration: setup_time + (time_each * quantity)
            duration = setup_time + (time_each * quantity_val)

            # Debug: Print the values used in the calculation
            print(f"    Calculating duration for Task {task_id}:")
            print(f"      setup_time = {setup_time}")
            print(f"      time_each = {time_each}")
            print(f"      quantity = {quantity_val}")
            print(f"      duration = {setup_time} + ({time_each} * {quantity_val}) = {duration}")

            # Ensure duration is a positive integer
            duration = int(max(1, duration))  # Ensure at least 1 minute to avoid zero duration

            resources = task["resources"]
            predecessors = task["predecessors"]
            task_to_index[task_id] = index
            all_tasks.append({
                "task_id": task_id,
                "duration": duration,
                "resources": resources,
                "predecessors": predecessors
            })
            job_tasks[job_number].append(index)
            index += 1

    # Debug: Validate task data
    print("\nTask Data Validation:")
    for i, task in enumerate(all_tasks):
        print(f"Task {task['task_id']}: Duration={task['duration']}, Resources={task['resources']}, Predecessors={task['predecessors']}")
        if task["duration"] <= 0:
            print(f"Warning: Task {task['task_id']} has duration <= 0. This may cause issues.")

    # Debug: Check for cycles in predecessor graph
    visited = [False] * len(all_tasks)
    stack = [False] * len(all_tasks)
    for task_id in task_to_index:
        if not visited[task_to_index[task_id]]:
            if detect_cycle(task_id, visited, stack, task_to_index, all_tasks):
                print("Error: Cycle detected in predecessor relationships. Scheduling cannot proceed.")
                return None

    # Step 3: Set up the OR-Tools model
    model = cp_model.CpModel()

    # Define the horizon
    horizon = sum(task["duration"] for task in all_tasks) * 2
    print(f"\nHorizon set to {horizon} minutes (approximately {horizon / (60 * 24):.2f} days)")

    # Variables: Start and end times for each task
    task_starts = {}
    task_ends = {}
    for i, task in enumerate(all_tasks):
        task_starts[i] = model.NewIntVar(0, horizon, f"start_{i}")
        task_ends[i] = model.NewIntVar(0, horizon, f"end_{i}")
        model.Add(task_ends[i] == task_starts[i] + task["duration"])

    # Predecessor constraints
    for i, task in enumerate(all_tasks):
        if not task["predecessors"]:
            continue
        for pred_task_number in task["predecessors"]:
            if not pred_task_number or pred_task_number.lower() == "nan":
                continue
            pred_task_id = (task["task_id"][0], pred_task_number)
            if pred_task_id in task_to_index:
                pred_index = task_to_index[pred_task_id]
                model.Add(task_starts[i] >= task_ends[pred_index])
            else:
                print(f"Warning: Predecessor {pred_task_id} for task {task['task_id']} not found.")

    # Resource constraints
    resource_intervals = {res_id: [] for res_id in resources_df["id"]}
    task_resource_assignments = {}

    for i, task in enumerate(all_tasks):
        task_resources = task["resources"]
        if not task_resources:
            print(f"Warning: Task {task['task_id']} has no resources specified.")
            continue

        for res in task_resources:
            if res in resource_mapping:
                res_id = resource_mapping[res]
                if res_id != -1:
                    interval = model.NewIntervalVar(
                        task_starts[i], task["duration"], task_ends[i], f"interval_{i}_res_{res_id}"
                    )
                    resource_intervals[res_id].append(interval)
                    if i not in task_resource_assignments:
                        task_resource_assignments[i] = []
                    task_resource_assignments[i].append(res_id)
            elif res in resource_group_mapping:
                group_resources = resource_group_mapping[res]
                if not group_resources:
                    print(f"Error: Resource group {res} has no resources for task {task['task_id']}.")
                    continue

                selected_resource = model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(group_resources),
                    f"selected_resource_{i}_{res}"
                )

                intervals = []
                bool_vars = []
                for res_id in group_resources:
                    is_active = model.NewBoolVar(f"use_res_{res_id}_for_task_{i}")
                    interval = model.NewOptionalIntervalVar(
                        task_starts[i],
                        task["duration"],
                        task_ends[i],
                        is_active,
                        f"interval_{i}_res_{res_id}"
                    )
                    intervals.append((res_id, interval, is_active))
                    bool_vars.append(is_active)

                model.AddExactlyOne(bool_vars)

                for res_id, interval, is_active in intervals:
                    resource_intervals[res_id].append(interval)

                for res_id, _, is_active in intervals:
                    model.Add(selected_resource == res_id).OnlyEnforceIf(is_active)
                    model.Add(selected_resource != res_id).OnlyEnforceIf(is_active.Not())

                if i not in task_resource_assignments:
                    task_resource_assignments[i] = []
                task_resource_assignments[i].append(selected_resource)

    # Enforce no overlap for each resource
    for res_id, intervals in resource_intervals.items():
        if intervals:
            print(f"Resource {res_id} has {len(intervals)} tasks assigned.")
            model.AddNoOverlap(intervals)
        else:
            print(f"Resource {res_id} has no tasks assigned.")

    # Objective: Minimize makespan
    makespan = model.NewIntVar(0, horizon, "makespan")
    model.AddMaxEquality(makespan, [task_ends[i] for i in range(len(all_tasks))])
    model.Minimize(makespan)

    # Step 4: Solve the model
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 60.0
    status = solver.Solve(model)

    # Step 5: Output the schedule
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        print("\nSchedule found!")
        print(f"Makespan: {solver.Value(makespan)} elapsed minutes")
        schedule = []
        id_to_resource = {v: k for k, v in resource_mapping.items()}
        resource_usage = {res_id: [] for res_id in resources_df["id"]}
        for i, task in enumerate(all_tasks):
            start = solver.Value(task_starts[i])
            end = solver.Value(task_ends[i])
            start_datetime = elapsed_minutes_to_datetime(start, start_date, working_hours)
            end_datetime = elapsed_minutes_to_datetime(end, start_date, working_hours)

            assigned_resources = []
            for res in task_resource_assignments.get(i, []):
                if isinstance(res, int):
                    assigned_resources.append(res)
                else:
                    assigned_resources.append(solver.Value(res))
            resource_names = [id_to_resource.get(res_id, str(res_id)) for res_id in assigned_resources]
            resources_used = ",".join(resource_names)

            for res_id in assigned_resources:
                resource_usage[res_id].append((task["task_id"], start, end))

            print(f"Task {task['task_id']}: Start = {start_datetime}, End = {end_datetime}, Resources = {resource_names}")
            schedule.append({
                "task_number": task["task_id"][1],
                "start_time": start_datetime,
                "end_time": end_datetime,
                "resources_used": resources_used
            })

        for res_id, usage in resource_usage.items():
            if not usage:
                continue
            usage.sort(key=lambda x: x[1])
            print(f"\nResource {id_to_resource.get(res_id, res_id)} usage (in elapsed minutes):")
            for task_id, start, end in usage:
                start_dt = elapsed_minutes_to_datetime(start, start_date, working_hours)
                end_dt = elapsed_minutes_to_datetime(end, start_date, working_hours)
                print(f"  Task {task_id}: {start} to {end} (Real time: {start_dt} to {end_dt})")
            for j in range(len(usage) - 1):
                task1, start1, end1 = usage[j]
                task2, start2, end2 = usage[j + 1]
                if end1 > start2:
                    print(f"  Overlap detected: Task {task1} (ends {end1}) overlaps with Task {task2} (starts {start2})")

        try:
            with engine.connect() as conn:
                conn.execute(sa.text("DELETE FROM public.schedule;"))
                for entry in schedule:
                    query = sa.text("""
                        INSERT INTO public.schedule (task_number, start_time, end_time, resources_used)
                        VALUES (:task_number, :start_time, :end_time, :resources_used);
                    """)
                    conn.execute(query, {
                        "task_number": entry["task_number"],
                        "start_time": entry["start_time"],
                        "end_time": entry["end_time"],
                        "resources_used": entry["resources_used"]
                    })
                conn.commit()
                print("Schedule successfully saved to the database!")
        except Exception as e:
            print(f"Error saving schedule to database: {e}")
            return None

        return schedule
    else:
        print("No solution found.")
        return None

# GUI class for scheduling
class SchedulerGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("Timely Scheduler")
        self.root.geometry("1000x700")

        # Label and date picker for starting date
        self.label = tk.Label(root, text="Select Schedule Start Date:")
        self.label.pack(pady=10)

        self.date_entry = DateEntry(root, width=12, background='darkblue',
                                   foreground='white', borderwidth=2, date_pattern='y-mm-dd')
        self.date_entry.pack(pady=10)

        # Schedule button
        self.schedule_button = tk.Button(root, text="Run Scheduler", command=self.run_scheduler)
        self.schedule_button.pack(pady=10)

        # Status label
        self.status_label = tk.Label(root, text="")
        self.status_label.pack(pady=10)

        # Error label (for displaying errors above the console)
        self.error_label = tk.Label(root, text="", fg="red")
        self.error_label.pack(pady=5)

        # Frame for the Matrix console
        self.console_frame = tk.Frame(root, bg="black")
        self.console_canvas = tk.Canvas(self.console_frame, bg="black", highlightthickness=0)
        self.console_text_frame = tk.Frame(self.console_canvas, bg="black")
        self.console_text_area = tk.Text(
            self.console_text_frame,
            bg="black",
            fg="#00FF00",
            font=("Courier", 12),
            wrap=tk.WORD,
            borderwidth=0,
            highlightthickness=0
        )
        self.console_scrollbar = tk.Scrollbar(self.console_text_frame, orient=tk.VERTICAL, command=self.console_text_area.yview)
        self.console_text_area.configure(yscrollcommand=self.console_scrollbar.set)
        self.console_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.console_text_area.pack(fill=tk.BOTH, expand=True)
        self.console_canvas.pack(fill=tk.BOTH, expand=True)
        self.console_text_area.config(state=tk.DISABLED)

        # Matrix effect variables
        self.columns = []
        self.chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%^&*()_+-=[]{}|;:,.<>?"
        self.drops = []
        self.matrix_active = False

        # Frame for the table and web interface button
        self.table_frame = tk.Frame(root)
        self.table_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Web interface button (initially hidden)
        self.web_button = tk.Button(self.table_frame, text="View on Web Interface",
                                   command=self.open_web_interface)
        # Table for displaying the schedule (initially empty)
        self.tree = None

        # Output buffer for capturing terminal output
        self.output_buffer = StringIO()

    def init_matrix_effect(self):
        # Calculate the number of columns based on window width
        width = self.console_canvas.winfo_screenwidth()
        self.column_width = 20  # Width of each column in pixels
        num_columns = width // self.column_width

        # Initialize drops for each column
        self.drops = [random.randint(-50, 0) for _ in range(num_columns)]
        self.columns = [[] for _ in range(num_columns)]

    def animate_matrix(self):
        if not self.matrix_active:
            return

        self.console_canvas.delete("matrix")  # Clear previous characters

        height = self.console_canvas.winfo_height() // self.column_width
        for i in range(len(self.drops)):
            # Get the current drop position
            y = self.drops[i]

            # If the drop is still on screen, add a new character
            if y >= 0 and y < height:
                char = random.choice(self.chars)
                # Fade effect: brighter at the top, dimmer as it falls
                brightness = max(0, 255 - (y * 10))
                color = f"#{brightness:02x}FF{brightness:02x}"
                self.console_canvas.create_text(
                    i * self.column_width + self.column_width // 2,
                    y * self.column_width,
                    text=char,
                    fill=color,
                    font=("Courier", 14),
                    tags="matrix"
                )

            # Move the drop down
            self.drops[i] += 1

            # Reset the drop if it reaches the bottom
            if self.drops[i] * self.column_width > self.console_canvas.winfo_height() and random.random() > 0.975:
                self.drops[i] = random.randint(-50, 0)

        # Schedule the next frame
        self.root.after(50, self.animate_matrix)

    def update_console(self):
        # Update the console text area with the latest output
        self.console_text_area.config(state=tk.NORMAL)
        self.console_text_area.delete(1.0, tk.END)
        self.console_text_area.insert(tk.END, self.output_buffer.getvalue())
        self.console_text_area.config(state=tk.DISABLED)
        self.console_text_area.yview(tk.END)  # Auto-scroll to the bottom
        self.root.after(100, self.update_console)  # Schedule the next update

    def show_console(self):
        # Show the Matrix console
        self.console_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        self.init_matrix_effect()
        self.matrix_active = True
        self.animate_matrix()
        self.update_console()

    def hide_console(self):
        # Hide the Matrix console
        self.matrix_active = False
        self.console_frame.pack_forget()

    def open_web_interface(self):
        webbrowser.open("https://nmiproduksie.azurewebsites.net/")
        self.root.destroy()

    def display_schedule(self, schedule):
        if self.tree:
            self.tree.destroy()

        self.web_button.pack(pady=5)

        self.tree = ttk.Treeview(self.table_frame, columns=("Task Number", "Start Time", "End Time", "Resources Used"),
                                show="headings")
        self.tree.heading("Task Number", text="Task Number")
        self.tree.heading("Start Time", text="Start Time")
        self.tree.heading("End Time", text="End Time")
        self.tree.heading("Resources Used", text="Resources Used")

        self.tree.column("Task Number", width=150)
        self.tree.column("Start Time", width=200)
        self.tree.column("End Time", width=200)
        self.tree.column("Resources Used", width=200)

        scrollbar = ttk.Scrollbar(self.table_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        for entry in schedule:
            self.tree.insert("", tk.END, values=(
                entry["task_number"],
                entry["start_time"].strftime("%Y-%m-%d %H:%M:%S"),
                entry["end_time"].strftime("%Y-%m-%d %H:%M:%S"),
                entry["resources_used"]
            ))

    def run_scheduler(self):
        start_date_str = self.date_entry.get()
        try:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
            self.status_label.config(text="Scheduling in progress...", fg="blue")
            self.error_label.config(text="")  # Clear any previous error
            if self.tree:  # Clear the previous schedule table if it exists
                self.tree.destroy()
            self.web_button.pack_forget()  # Hide the web button
            self.show_console()  # Show the Matrix console
            self.root.update()

            # Clear the output buffer
            self.output_buffer.seek(0)
            self.output_buffer.truncate(0)

            # Run the scheduling in a separate thread to keep the GUI responsive
            self.root.after(100, lambda: self.schedule_in_thread(start_date))

        except ValueError:
            self.status_label.config(text="Invalid date format. Use YYYY-MM-DD.", fg="red")
            self.hide_console()

    def schedule_in_thread(self, start_date):
        schedule = schedule_jobs(start_date, self.output_buffer)
        self.root.after(0, lambda: self.handle_schedule_result(schedule))

    def handle_schedule_result(self, schedule):
        sys.stdout = sys.__stdout__  # Restore stdout

        if schedule:
            self.status_label.config(text="Scheduling complete! Saved to database.", fg="green")
            self.display_schedule(schedule)
            self.hide_console()  # Hide the console on success
            self.error_label.config(text="")  # Clear any error message
        else:
            self.status_label.config(text="Scheduling failed.", fg="red")
            self.error_label.config(text="Scheduling failed. See console output below for details.", fg="red")
            # Keep the console visible to show the error details

# Main function to launch the GUI
if __name__ == "__main__":
    root = tk.Tk()
    app = SchedulerGUI(root)
    root.mainloop()