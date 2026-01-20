from models import State
import matplotlib.pyplot as plt
import matplotlib.cm as cm
import numpy as np

def main():
    state = State()

    demands: dict[str, list[float]] = {}
    for zone in state.zones:
        demands[zone.id] = []

    for current_time in range(0, 24 * 60):
        for z in state.zones:
            z.update_demand(current_time)
            demands[z.id].append(z.demand[current_time])

    # Plot all zone demands
    plt.figure(figsize=(12, 6))
    
    # Convert minutes to hours for x-axis
    hours = np.arange(0, 24 * 60) / 60
    
    # Use a colormap to get distinct colors for each zone
    colors = cm.tab10(np.linspace(0, 1, len(demands)))
    
    for (zone_id, demand_values), color in zip(demands.items(), colors):
        plt.plot(hours, demand_values, label=zone_id, color=color)
    
    plt.title('Zone Demand Throughout the Day')
    plt.xlabel('Hour of Day')
    plt.ylabel('Demand')
    plt.xticks(np.arange(0, 25, 2))
    plt.grid(True, alpha=0.3)
    plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    main()