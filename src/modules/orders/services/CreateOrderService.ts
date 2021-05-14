import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // TODO
    if (!products) {
      throw new AppError('No products were sent with the order.', 400);
    }
    const productsIds = products.map(p => ({
      id: p.id,
    }));

    const findProducts = await this.productsRepository.findAllById(productsIds);

    if (findProducts.length !== productsIds.length) {
      throw new AppError(
        "There are some products in this order that doesn't exists.",
        400,
      );
    }

    const iProducts = findProducts.map(p => {
      const productPosted = products.find(pf => pf.id === p.id);
      const newProductQuantity = p.quantity - (productPosted?.quantity || 0);
      if (newProductQuantity < 0) {
        throw new AppError('One of the products is  out of stock.');
      }
      return {
        product_id: p.id,
        price: p.price,
        quantity: productPosted?.quantity || 0,
      };
    });

    const changedProducts = findProducts.map(p => {
      const productPosted = products.find(pf => pf.id === p.id);
      const newProductQuantity = p.quantity - (productPosted?.quantity || 0);
      return {
        id: p.id,
        quantity: newProductQuantity,
      };
    });

    this.productsRepository.updateQuantity(changedProducts);

    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError("Customer doesn't exists.", 400);
    }

    const order = await this.ordersRepository.create({
      customer,
      products: iProducts,
    });

    return order;
  }
}

export default CreateOrderService;
