import { StateVarList, StyleVarList } from 'statebinderk';
import { NEPAL_ROUTES } from './nepalMapData';

export interface RouteOwnershipBinding {
  ownerId: number | null;
  ownerColor: string;
  ownerName: string;
  highlighted?: boolean;
}

export class BoardBinder {
  public readonly routeOwners: StateVarList<RouteOwnershipBinding>;
  public readonly routeGlowStyles: StyleVarList<string>;

  public constructor() {
    const initialOwners = NEPAL_ROUTES.map((r) => ({
      id: `route-${r.id}`,
      state: {
        ownerId: null,
        ownerColor: '',
        ownerName: '',
        highlighted: false,
      } as RouteOwnershipBinding,
    }));

    this.routeOwners = new StateVarList<RouteOwnershipBinding>(
      initialOwners,
      (element, state) => {
        const routeId = element.getAttribute('data-route-id');
        const tokenGroup = routeId
          ? document.getElementById(`route-owner-token-${routeId}`)
          : null;

        if (state.ownerId !== null) {
          element.classList.add('route-claimed');
          const boxes = element.querySelectorAll('.route-segment-box');
          boxes.forEach((box) => {
            box.setAttribute('fill', state.ownerColor);
            box.setAttribute('stroke', '#fffdf9');
            box.setAttribute('stroke-width', '2');
          });
          if (tokenGroup) {
            tokenGroup.innerHTML = `
              <circle r="9" fill="${state.ownerColor}" stroke="#fffdf9" stroke-width="2" />
              <text y="3.5" text-anchor="middle" fill="#fffdf9" font-size="9" font-weight="800">
                ${state.ownerName.slice(0, 1).toUpperCase()}
              </text>
            `;
          }
        } else {
          element.classList.remove('route-claimed');
          if (tokenGroup) {
            tokenGroup.innerHTML = '';
          }
        }

        if (state.highlighted) {
          element.classList.add('route-longest-highlight');
        } else {
          element.classList.remove('route-longest-highlight');
        }
      }
    );

    const initialGlows = NEPAL_ROUTES.map((r) => ({
      id: `route-${r.id}`,
      state: 'none',
    }));

    this.routeGlowStyles = new StyleVarList<string>(
      initialGlows,
      'filter'
    );
  }

  public claimRoute(routeId: number, ownerId: number, ownerColor: string, ownerName: string): void {
    this.routeOwners.transition(routeId, {
      ownerId,
      ownerColor,
      ownerName,
      highlighted: false,
    });
  }

  public setRouteHighlight(routeId: number, highlighted: boolean): void {
    const current = this.routeOwners.current(routeId);
    if (current) {
      this.routeOwners.transition(routeId, {
        ...current,
        highlighted,
      });
      this.routeGlowStyles.transition(
        routeId,
        highlighted ? 'drop-shadow(0 0 6px #d99b26)' : 'none'
      );
    }
  }
}
