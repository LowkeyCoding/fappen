import {promise_cond} from "./util/async";
import config from "../config"

const {base_api_url, default_room} = config;

// @ts-ignore - the analyzer does not know how to deal with `bundle-text` imports
import access_failure_msg from 'bundle-text:../components/stregsystem/access_failure.pug';

export interface UserProfile {
    username: string,
    id: number,
    active: boolean,
    name: string,
    balance: number,
}

interface SaleResponse {
    status: string,
    msg: string,
    values: {
        order: {
            room: number,
            member: number, // string?
            create_on: string,
            items: string,
        },
        promille: number,
        is_ballmer_peaking: boolean
        bp_minutes: number,
        bp_seconds: number,
        caffeine: number,
        cups: number,
        product_contains_caffeine: boolean,
        is_coffee_master: boolean,
        cost: number,
        give_multibuy_hint: boolean,
        sale_hints: boolean,
    }
}

interface ActiveProductList {
    [product_id: string]: [
        string, // Product name
        number, // Price
    ]
}

/*
    API Calls
 */

/**
 * Gets the id that corresponds to a given username.
 * @param username
 */
const get_user_id = (username: string): Promise<number> =>
    fetch(`${base_api_url}/member/get_id?username=${username}`)
        .then(res => promise_cond(res.status === 200, res, "Invalid status code"))
        .then(res => res.json())
        .then(value => value['member_id']);

/**
 * Gets the user information associated with the given user id.
 * @param user_id
 */
const get_user_info = (user_id: number): Promise<any> =>
    fetch(`${base_api_url}/member?member_id=${user_id}`)
        .then(res => promise_cond(res.status === 200, res, res))
        .then(res => res.json());

/**
 * Get the current balance of the given user by id.
 * @param user_id
 */
const get_user_balance = (user_id: number): Promise<number> =>
    fetch(`${base_api_url}/member/balance?member_id=${user_id}`)
        .then(res => promise_cond(res.status === 200, res, res))
        .then(res => res.json())
        .then(value => value['balance']);

/**
 * Get a list of products that are active within a given room.
 * @param room_id
 */
const get_active_products = (room_id: number): Promise<ActiveProductList> =>
    fetch(`${base_api_url}/products/active_products?room_id=${room_id}`)
        .then(res => promise_cond(res.status === 200, res, res))
        .then(res => res.json())

/**
 * Performs a sale request.
 * @param buystring A string describing the products that are to be purchased.
 * @param room
 * @param user_id
 */
const post_sale = (buystring: string, room: number, user_id: number): Promise<SaleResponse> =>
    fetch(`${base_api_url}/sale`, {
        method: 'POST',
        cache: "no-cache",
        headers: {
            "Content-Type": 'application/json'
        },

        body: JSON.stringify({buy_string: buystring, room, member_id: user_id})
    })
        .then(res => promise_cond(res.status === 200, res, res))
        .then(res => res.json());


/*
    Public interface
 */

/**
 * Check whether the stregsystem can be reached.
 */
export const check_access = async (): Promise<boolean> => {
    try {
        // TODO check whether API is available after verifying that stresystem is available
        return (await fetch(`${base_api_url}/..`)).status == 200;
    } catch (err) {
        console.log("Stregsystem access check failed.");
        console.log(err);
        return false;
    }
}

/**
 * Fetches a user profile by username.
 * @param username
 */
export const fetch_profile = async (username: string): Promise<UserProfile> => {
    let user_id = await get_user_id(username);
    let {name, active, balance} = await get_user_info(user_id);

    return {
        username, id: user_id,
        name, active, balance,
    };
}

/*
    UI / HTML Elements
 */

/**
 * Custom HTML element class for element `<fa-streg-product>`.
 * Represents a stregsystem product.
 */
class FaStregProduct extends HTMLElement {
    target_cart: FaStregCart;

    product_id: number;
    price: number;
    name: string;

    constructor(target: FaStregCart, product_id: number, name: string, price: number) {
        super();

        this.target_cart = target;

        this.product_id = product_id;
        this.price = price;
        this.name = name;

        // Maybe use shadow root instead?
        this.innerHTML = `${price} - ${name}`;
    }



}

class FaStregCart extends HTMLElement {
    contents: {[id: number]: number};
    constructor() {
        super();
    }

    getBuyString(): string {
        return Object.keys(this.contents)
            .filter(key => this.contents[key] > 0)
            .map(key => `${key}:${this.contents[key]}`)
            .join(' ');
    }
}

class FaStregsystem extends HTMLElement {

    cart: FaStregCart;

    constructor() {
        super();

        (async (self) => {
            console.log("initiating stregsystem module");
            if (await check_access() == false) {
                console.log("unable to connect to stregsystem");
                self.classList.add('flex-center', 'center');
                self.innerHTML = access_failure_msg;
                return;
            }

            self.cart = new FaStregCart();

            const active_products = await get_active_products(default_room);
            const product_elements = Object.keys(active_products)
                .map(key => new FaStregProduct(self.cart, parseInt(key), ...active_products[key]));

            self.append(...product_elements);
        })(this)

    }
}

export const init = async () => {
    customElements.define("fa-streg-product", FaStregProduct);
    customElements.define("fa-streg-cart", FaStregCart);
    customElements.define("fa-stregsystem", FaStregsystem);
}
