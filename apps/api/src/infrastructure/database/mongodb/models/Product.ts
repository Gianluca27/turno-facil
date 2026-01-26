import mongoose, { Schema, Document, Model } from 'mongoose';

// Interfaces
export interface IProductVariant {
  name: string;
  sku?: string;
  barcode?: string;
  price: number;
  stock: number;
  attributes: Map<string, string>;
}

export interface IProductStats {
  totalSold: number;
  totalRevenue: number;
}

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  businessId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  price: number;
  costPrice?: number;
  stock: number;
  lowStockThreshold: number;
  category: string;
  brand?: string;
  images: string[];
  hasVariants: boolean;
  variants: IProductVariant[];
  tags: string[];
  stats: IProductStats;
  trackInventory: boolean;
  allowNegativeStock: boolean;
  taxable: boolean;
  taxRate?: number;
  weight?: number;
  weightUnit?: 'kg' | 'g' | 'lb' | 'oz';
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'in';
  };
  order: number;
  status: 'active' | 'inactive' | 'deleted';
  createdAt: Date;
  updatedAt: Date;

  // Virtuals
  isLowStock: boolean;
  profitMargin: number | null;
}

export interface IProductModel extends Model<IProduct> {
  findByBusiness(businessId: string | mongoose.Types.ObjectId): Promise<IProduct[]>;
  findActiveByBusiness(businessId: string | mongoose.Types.ObjectId): Promise<IProduct[]>;
  findByCategory(businessId: string | mongoose.Types.ObjectId, category: string): Promise<IProduct[]>;
  findByBarcode(businessId: string | mongoose.Types.ObjectId, barcode: string): Promise<IProduct | null>;
  findBySku(businessId: string | mongoose.Types.ObjectId, sku: string): Promise<IProduct | null>;
  updateStock(productId: string | mongoose.Types.ObjectId, quantity: number): Promise<IProduct | null>;
  getLowStockProducts(businessId: string | mongoose.Types.ObjectId): Promise<IProduct[]>;
}

// Schema
const productVariantSchema = new Schema<IProductVariant>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    sku: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    barcode: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
    attributes: {
      type: Map,
      of: String,
      default: new Map(),
    },
  },
  { _id: true }
);

const productSchema = new Schema<IProduct, IProductModel>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: 'Business',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      maxlength: 2000,
    },
    sku: {
      type: String,
      trim: true,
      maxlength: 50,
      sparse: true,
    },
    barcode: {
      type: String,
      trim: true,
      maxlength: 50,
      sparse: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    costPrice: {
      type: Number,
      min: 0,
    },
    stock: {
      type: Number,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 5,
      min: 0,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 10,
        message: 'A product can have a maximum of 10 images',
      },
    },
    hasVariants: {
      type: Boolean,
      default: false,
    },
    variants: {
      type: [productVariantSchema],
      default: [],
      validate: {
        validator: (v: IProductVariant[]) => v.length <= 50,
        message: 'A product can have a maximum of 50 variants',
      },
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 20,
        message: 'A product can have a maximum of 20 tags',
      },
    },
    stats: {
      totalSold: {
        type: Number,
        default: 0,
      },
      totalRevenue: {
        type: Number,
        default: 0,
      },
    },
    trackInventory: {
      type: Boolean,
      default: true,
    },
    allowNegativeStock: {
      type: Boolean,
      default: false,
    },
    taxable: {
      type: Boolean,
      default: true,
    },
    taxRate: {
      type: Number,
      min: 0,
      max: 100,
    },
    weight: {
      type: Number,
      min: 0,
    },
    weightUnit: {
      type: String,
      enum: ['kg', 'g', 'lb', 'oz'],
      default: 'kg',
    },
    dimensions: {
      length: { type: Number, min: 0 },
      width: { type: Number, min: 0 },
      height: { type: Number, min: 0 },
      unit: { type: String, enum: ['cm', 'in'], default: 'cm' },
    },
    order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deleted'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
productSchema.index({ businessId: 1, status: 1 });
productSchema.index({ businessId: 1, category: 1, status: 1 });
productSchema.index({ businessId: 1, sku: 1 }, { unique: true, sparse: true });
productSchema.index({ businessId: 1, barcode: 1 }, { unique: true, sparse: true });
productSchema.index({ businessId: 1, name: 'text', description: 'text' });
productSchema.index({ businessId: 1, stock: 1, lowStockThreshold: 1 });
productSchema.index({ 'variants.sku': 1 }, { sparse: true });
productSchema.index({ 'variants.barcode': 1 }, { sparse: true });

// Virtuals
productSchema.virtual('isLowStock').get(function (this: IProduct): boolean {
  if (!this.trackInventory) return false;
  return this.stock <= this.lowStockThreshold;
});

productSchema.virtual('profitMargin').get(function (this: IProduct): number | null {
  if (!this.costPrice || this.costPrice === 0) return null;
  return ((this.price - this.costPrice) / this.costPrice) * 100;
});

// Static methods
productSchema.statics.findByBusiness = function (
  businessId: string | mongoose.Types.ObjectId
): Promise<IProduct[]> {
  return this.find({
    businessId,
    status: { $ne: 'deleted' },
  }).sort({ order: 1, name: 1 });
};

productSchema.statics.findActiveByBusiness = function (
  businessId: string | mongoose.Types.ObjectId
): Promise<IProduct[]> {
  return this.find({
    businessId,
    status: 'active',
  }).sort({ order: 1, name: 1 });
};

productSchema.statics.findByCategory = function (
  businessId: string | mongoose.Types.ObjectId,
  category: string
): Promise<IProduct[]> {
  return this.find({
    businessId,
    category,
    status: 'active',
  }).sort({ order: 1, name: 1 });
};

productSchema.statics.findByBarcode = function (
  businessId: string | mongoose.Types.ObjectId,
  barcode: string
): Promise<IProduct | null> {
  return this.findOne({
    businessId,
    $or: [{ barcode }, { 'variants.barcode': barcode }],
    status: 'active',
  });
};

productSchema.statics.findBySku = function (
  businessId: string | mongoose.Types.ObjectId,
  sku: string
): Promise<IProduct | null> {
  return this.findOne({
    businessId,
    $or: [{ sku }, { 'variants.sku': sku }],
    status: 'active',
  });
};

productSchema.statics.updateStock = function (
  productId: string | mongoose.Types.ObjectId,
  quantity: number
): Promise<IProduct | null> {
  return this.findByIdAndUpdate(
    productId,
    { $inc: { stock: quantity } },
    { new: true }
  );
};

productSchema.statics.getLowStockProducts = function (
  businessId: string | mongoose.Types.ObjectId
): Promise<IProduct[]> {
  return this.find({
    businessId,
    status: 'active',
    trackInventory: true,
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
  }).sort({ stock: 1 });
};

// Pre-save middleware
productSchema.pre('save', function (next) {
  // Ensure stock is not negative if not allowed
  if (!this.allowNegativeStock && this.stock < 0) {
    this.stock = 0;
  }
  next();
});

export const Product = mongoose.model<IProduct, IProductModel>('Product', productSchema);
